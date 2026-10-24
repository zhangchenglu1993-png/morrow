import { randomUUID } from "node:crypto";
import { getDb, getSettingNumber, setSetting, withTransaction } from "./db";
import { getUserPoints } from "./contribution";
import { majorVoteWeight, rankForPoints } from "./ranks";

import { SETTING_OPTIONS, type ProposalKind, type ProposalStatus, type SettingKey, type VoteChoice, type ProposalView } from "./governance-shared";
export { SETTING_OPTIONS } from "./governance-shared";
export type { ProposalKind, ProposalStatus, SettingKey, VoteChoice, ProposalView } from "./governance-shared";


function calculateEndorsements(kind: ProposalKind): number {
  return kind === "normal" ? 3 : 5;
}

function settingsValueForStorage(key: SettingKey, raw: string): string {
  const option = SETTING_OPTIONS.find((item) => item.key === key);
  if (!option) throw new Error("未知的规则项。");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < option.min || value > option.max) {
    throw new Error(`规则值需要是 ${option.min} 到 ${option.max} 之间的整数。`);
  }
  return key === "negative_hide_ratio_percent" ? String(value / 100) : String(value);
}

function applyProposalSetting(proposal: {
  setting_key: string | null;
  setting_value: string | null;
}): void {
  if (!proposal.setting_key || !proposal.setting_value) return;
  if (!SETTING_OPTIONS.some((option) => option.key === proposal.setting_key)) return;
  setSetting(proposal.setting_key, proposal.setting_value);
}

function eligibleVoterCount(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM users
       WHERE email_verified = 1
         AND datetime(COALESCE(last_login_at, created_at)) >= datetime('now', '-30 days')`
    )
    .get() as { count: number };
  return Number(row.count);
}

export function advanceProposals(): void {
  const db = getDb();
  const proposals = db
    .prepare(
      `SELECT id, kind, status, discussion_ends_at, vote_ends_at
       FROM proposals WHERE status IN ('collecting', 'discussion', 'voting')`
    )
    .all() as Array<{
    id: string;
    kind: ProposalKind;
    status: ProposalStatus;
    discussion_ends_at: string | null;
    vote_ends_at: string | null;
  }>;
  const now = Date.now();
  for (const proposal of proposals) {
    if (proposal.status === "collecting") {
      const count = db
        .prepare("SELECT COUNT(*) AS count FROM proposal_endorsements WHERE proposal_id = ?")
        .get(proposal.id) as { count: number };
      if (Number(count.count) >= calculateEndorsements(proposal.kind)) {
        const days = proposal.kind === "normal" ? 3 : 7;
        db.prepare(
          "UPDATE proposals SET status = 'discussion', discussion_ends_at = ? WHERE id = ?"
        ).run(new Date(now + days * 86_400_000).toISOString(), proposal.id);
      }
    } else if (
      proposal.status === "discussion" &&
      proposal.discussion_ends_at &&
      new Date(proposal.discussion_ends_at).getTime() <= now
    ) {
      const hours = proposal.kind === "normal" ? 48 : 72;
      db.prepare(
        "UPDATE proposals SET status = 'voting', vote_ends_at = ? WHERE id = ?"
      ).run(new Date(now + hours * 3_600_000).toISOString(), proposal.id);
    } else if (
      proposal.status === "voting" &&
      proposal.vote_ends_at &&
      new Date(proposal.vote_ends_at).getTime() <= now
    ) {
      const votes = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN choice = 'yes' THEN weight ELSE 0 END), 0) AS yes,
             COALESCE(SUM(CASE WHEN choice = 'no' THEN weight ELSE 0 END), 0) AS no,
             COUNT(*) AS voters
           FROM proposal_votes WHERE proposal_id = ?`
        )
        .get(proposal.id) as { yes: number; no: number; voters: number };
      const quorum = Math.max(1, Math.ceil(eligibleVoterCount() * 0.5));
      const passed =
        Number(votes.voters) >= quorum && Number(votes.yes) > Number(votes.no);
      db.prepare(
        "UPDATE proposals SET status = ?, decided_at = ? WHERE id = ?"
      ).run(passed ? "passed" : "rejected", new Date().toISOString(), proposal.id);
      if (passed) {
        const full = db
          .prepare("SELECT setting_key, setting_value FROM proposals WHERE id = ?")
          .get(proposal.id) as { setting_key: string | null; setting_value: string | null };
        applyProposalSetting(full);
      }
    }
  }
}

function requiredEndorsementsForUser(kind: ProposalKind, userId: string): boolean {
  const level = rankForPoints(getUserPoints(userId)).current.level;
  return kind === "normal" ? level >= 16 : level >= 18;
}

export function createProposal(input: {
  userId: string;
  kind: ProposalKind;
  title: string;
  body: string;
  settingKey: SettingKey | null;
  settingValue: string | null;
}): { ok: boolean; id?: string; error?: string } {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 4 || title.length > 120) {
    return { ok: false, error: "提案标题需要 4 到 120 个字。" };
  }
  if (body.length < 20 || body.length > 3000) {
    return { ok: false, error: "提案说明需要 20 到 3,000 个字。" };
  }
  let storedValue: string | null = null;
  if (input.settingKey) {
    if (!input.settingValue) return { ok: false, error: "请填写希望修改成的规则值。" };
    try {
      storedValue = settingsValueForStorage(input.settingKey, input.settingValue);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "规则值无效。"
      };
    }
  }

  const id = randomUUID();
  const now = new Date();
  const startsDiscussion = requiredEndorsementsForUser(input.kind, input.userId);
  const discussionEnds = startsDiscussion
    ? new Date(now.getTime() + (input.kind === "normal" ? 3 : 7) * 86_400_000).toISOString()
    : null;
  withTransaction((db) => {
    db.prepare(
      `INSERT INTO proposals
        (id, kind, title, body, author_id, status, setting_key, setting_value,
         discussion_ends_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.kind,
      title,
      body,
      input.userId,
      startsDiscussion ? "discussion" : "collecting",
      input.settingKey,
      storedValue,
      discussionEnds,
      now.toISOString()
    );
    db.prepare(
      "INSERT INTO proposal_endorsements (proposal_id, user_id, created_at) VALUES (?, ?, ?)"
    ).run(id, input.userId, now.toISOString());
  });
  return { ok: true, id };
}

export function endorseProposal(
  userId: string,
  proposalId: string
): { ok: boolean; error?: string } {
  const db = getDb();
  const proposal = db
    .prepare("SELECT id, kind, status FROM proposals WHERE id = ?")
    .get(proposalId) as { id: string; kind: ProposalKind; status: ProposalStatus } | undefined;
  if (!proposal) return { ok: false, error: "提案不存在。" };
  if (proposal.status !== "collecting") return { ok: false, error: "这个提案已经进入下一阶段。" };
  db.prepare(
    "INSERT OR IGNORE INTO proposal_endorsements (proposal_id, user_id, created_at) VALUES (?, ?, ?)"
  ).run(proposalId, userId, new Date().toISOString());
  advanceProposals();
  return { ok: true };
}

export function closeProposalDiscussion(
  userId: string,
  proposalId: string
): { ok: boolean; error?: string } {
  const level = rankForPoints(getUserPoints(userId)).current.level;
  if (level < 17) return { ok: false, error: "需要第 17 级及以上的社区权限。" };
  const proposal = getDb()
    .prepare("SELECT status FROM proposals WHERE id = ?")
    .get(proposalId) as { status: ProposalStatus } | undefined;
  if (!proposal || proposal.status !== "discussion") {
    return { ok: false, error: "这个提案不在讨论阶段。" };
  }
  getDb()
    .prepare("UPDATE proposals SET discussion_ends_at = ? WHERE id = ?")
    .run(new Date().toISOString(), proposalId);
  advanceProposals();
  return { ok: true };
}

export function castVote(
  userId: string,
  proposalId: string,
  choice: VoteChoice
): { ok: boolean; error?: string } {
  if (!["yes", "no", "abstain"].includes(choice)) return { ok: false, error: "无效的选择。" };
  advanceProposals();
  const db = getDb();
  const proposal = db
    .prepare("SELECT id, kind, status, vote_ends_at FROM proposals WHERE id = ?")
    .get(proposalId) as
    | { id: string; kind: ProposalKind; status: ProposalStatus; vote_ends_at: string | null }
    | undefined;
  if (!proposal) return { ok: false, error: "提案不存在。" };
  if (proposal.status !== "voting") return { ok: false, error: "现在不在投票阶段。" };
  const level = rankForPoints(getUserPoints(userId)).current.level;
  const weight = proposal.kind === "major" ? majorVoteWeight(level) : 1;
  db.prepare(
    `INSERT INTO proposal_votes (proposal_id, user_id, choice, weight, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(proposal_id, user_id) DO UPDATE SET
       choice = excluded.choice, weight = excluded.weight, created_at = excluded.created_at`
  ).run(proposalId, userId, choice, weight, new Date().toISOString());
  return { ok: true };
}

export function addProposalComment(
  userId: string,
  proposalId: string,
  body: string
): { ok: boolean; error?: string } {
  const text = body.trim();
  if (!text || text.length > 800) {
    return { ok: false, error: "讨论内容需要 1 到 800 个字。" };
  }
  const db = getDb();
  const proposal = db
    .prepare("SELECT status FROM proposals WHERE id = ?")
    .get(proposalId) as { status: ProposalStatus } | undefined;
  if (!proposal || !["collecting", "discussion", "voting"].includes(proposal.status)) {
    return { ok: false, error: "这个提案已经结束讨论。" };
  }
  db.prepare(
    `INSERT INTO proposal_comments (id, proposal_id, author_id, body, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), proposalId, userId, text, new Date().toISOString());
  return { ok: true };
}

export function getProposals(viewerId?: string | null): ProposalView[] {
  advanceProposals();
  const db = getDb();
  const proposals = db
    .prepare(
      `SELECT p.*, u.display_name, u.avatar_emoji
       FROM proposals p JOIN users u ON u.id = p.author_id
       ORDER BY
         CASE p.status WHEN 'collecting' THEN 0 WHEN 'discussion' THEN 1 WHEN 'voting' THEN 2 ELSE 3 END,
         p.created_at DESC`
    )
    .all() as Array<{
    id: string;
    kind: ProposalKind;
    title: string;
    body: string;
    status: ProposalStatus;
    author_id: string;
    display_name: string;
    avatar_emoji: string;
    setting_key: SettingKey | null;
    setting_value: string | null;
    discussion_ends_at: string | null;
    vote_ends_at: string | null;
    created_at: string;
    decided_at: string | null;
  }>;

  return proposals.map((proposal) => {
    const authorPoints = getUserPoints(proposal.author_id);
    const authorRank = rankForPoints(authorPoints);
    const endorsementCount = db
      .prepare("SELECT COUNT(*) AS count FROM proposal_endorsements WHERE proposal_id = ?")
      .get(proposal.id) as { count: number };
    const myEndorsement = viewerId
      ? Boolean(
          db
            .prepare(
              "SELECT 1 AS found FROM proposal_endorsements WHERE proposal_id = ? AND user_id = ?"
            )
            .get(proposal.id, viewerId)
        )
      : false;
    const voteSummary = db
      .prepare(
        `SELECT
           COUNT(*) AS voters,
           COALESCE(SUM(CASE WHEN choice = 'yes' THEN weight ELSE 0 END), 0) AS yes,
           COALESCE(SUM(CASE WHEN choice = 'no' THEN weight ELSE 0 END), 0) AS no,
           COALESCE(SUM(CASE WHEN choice = 'abstain' THEN weight ELSE 0 END), 0) AS abstain
         FROM proposal_votes WHERE proposal_id = ?`
      )
      .get(proposal.id) as { voters: number; yes: number; no: number; abstain: number };
    const myVote = viewerId
      ? ((db
          .prepare(
            "SELECT choice FROM proposal_votes WHERE proposal_id = ? AND user_id = ?"
          )
          .get(proposal.id, viewerId) as { choice: VoteChoice } | undefined)?.choice ?? null)
      : null;
    const comments = db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.display_name, u.avatar_emoji
         FROM proposal_comments c JOIN users u ON u.id = c.author_id
         WHERE c.proposal_id = ? ORDER BY c.created_at ASC`
      )
      .all(proposal.id) as Array<{
      id: string;
      body: string;
      created_at: string;
      display_name: string;
      avatar_emoji: string;
    }>;
    return {
      id: proposal.id,
      kind: proposal.kind,
      title: proposal.title,
      body: proposal.body,
      status: proposal.status,
      author: {
        id: proposal.author_id,
        displayName: proposal.display_name,
        avatarEmoji: proposal.avatar_emoji,
        level: authorRank.current.level,
        title: authorRank.current.title
      },
      settingKey: proposal.setting_key,
      settingValue: proposal.setting_value,
      discussionEndsAt: proposal.discussion_ends_at,
      voteEndsAt: proposal.vote_ends_at,
      createdAt: proposal.created_at,
      decidedAt: proposal.decided_at,
      endorsements: Number(endorsementCount.count),
      requiredEndorsements: calculateEndorsements(proposal.kind),
      myEndorsement,
      votes: {
        yes: Number(voteSummary.yes),
        no: Number(voteSummary.no),
        abstain: Number(voteSummary.abstain),
        voters: Number(voteSummary.voters)
      },
      myVote,
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at,
        authorName: comment.display_name,
        authorEmoji: comment.avatar_emoji
      }))
    };
  });
}

export function getCurrentRuleSnapshot() {
  return {
    minFeedbackParticipants: getSettingNumber("min_feedback_participants", 10),
    negativeHidePercent: Math.round(getSettingNumber("negative_hide_ratio", 0.2) * 100),
    commentHideFlags: getSettingNumber("comment_hide_flags", 5),
    dailyContributionCap: getSettingNumber("daily_contribution_cap", 60),
    eligibleVoters: eligibleVoterCount()
  };
}
