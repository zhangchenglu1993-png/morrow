import { randomInt, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb, withTransaction } from "./db";
import { hashToken } from "./security";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 每位成员同时最多持有多少个未使用、未过期的邀请码。
// 邀请被使用或过期后名额自动释放，鼓励邀请真实的人，而不是囤积邀请码。
export const MEMBER_ACTIVE_INVITE_LIMIT = 3;

function randomGroup(length: number): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function insertInvitation(
  db: DatabaseSync,
  createdBy: string,
  daysValid: number
): { code: string; id: string; expiresAt: string } {
  const raw = `MORROW-${randomGroup(4)}-${randomGroup(4)}`;
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysValid * 86_400_000);
  db.prepare(
    `INSERT INTO invitations
      (id, code_hash, code_prefix, created_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    hashToken(raw),
    raw.slice(0, 11),
    createdBy,
    expiresAt.toISOString(),
    now.toISOString()
  );
  return { code: raw, id, expiresAt: expiresAt.toISOString() };
}

export function createInvitation(
  createdBy: string,
  daysValid = 7
): { code: string; id: string; expiresAt: string } {
  return withTransaction((db) => insertInvitation(db, createdBy, daysValid));
}

export type InvitationRow = {
  id: string;
  code_prefix: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

export function findInvitation(code: string): InvitationRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, code_prefix, expires_at, used_by, used_at, created_at
       FROM invitations WHERE code_hash = ?`
    )
    .get(hashToken(normalizeInviteCode(code))) as InvitationRow | undefined;
  return row ?? null;
}

export function consumeInvitation(code: string, userId: string): boolean {
  return withTransaction((db) => {
    const row = db
      .prepare(
        `SELECT id, expires_at, used_by FROM invitations WHERE code_hash = ?`
      )
      .get(hashToken(normalizeInviteCode(code))) as
      | { id: string; expires_at: string; used_by: string | null }
      | undefined;
    if (!row || row.used_by || new Date(row.expires_at).getTime() <= Date.now()) {
      return false;
    }
    db.prepare(
      "UPDATE invitations SET used_by = ?, used_at = ? WHERE id = ? AND used_by IS NULL"
    ).run(userId, new Date().toISOString(), row.id);
    return true;
  });
}

export function listInvitations(): InvitationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, code_prefix, expires_at, used_by, used_at, created_at
       FROM invitations ORDER BY created_at DESC`
    )
    .all() as InvitationRow[];
  return rows.map((row) => ({
    id: row.id,
    code_prefix: row.code_prefix,
    expires_at: row.expires_at,
    used_by: row.used_by,
    used_at: row.used_at,
    created_at: row.created_at
  }));
}

export type InviteeRow = {
  id: string;
  displayName: string;
  avatarEmoji: string;
  joinedAt: string;
  invitePrefix: string;
};

export type AdminInvitationRow = InvitationRow & {
  creatorName: string;
  usedByName: string | null;
};

export type InvitationIssue =
  | { ok: true; code: string; id: string; expiresAt: string }
  | { ok: false; reason: "limit"; active: number; limit: number };

function countActiveInvitationsIn(db: DatabaseSync, createdBy: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM invitations
       WHERE created_by = ? AND used_by IS NULL AND expires_at > ?`
    )
    .get(createdBy, new Date().toISOString()) as { count: number };
  return Number(row.count);
}

export function countActiveInvitations(createdBy: string): number {
  return countActiveInvitationsIn(getDb(), createdBy);
}

/**
 * 成员可以邀请同行者，但需要遵守同时持有的邀请码上限。
 * 产品负责人不受限制，便于首批种子用户入场和运营兜底。
 */
export function createInvitationForUser(
  user: { id: string; role: "owner" | "member" },
  daysValid = 7
): InvitationIssue {
  return withTransaction((db) => {
    if (user.role === "member") {
      const active = countActiveInvitationsIn(db, user.id);
      if (active >= MEMBER_ACTIVE_INVITE_LIMIT) {
        return {
          ok: false,
          reason: "limit",
          active,
          limit: MEMBER_ACTIVE_INVITE_LIMIT
        } as const;
      }
    }
    return { ok: true, ...insertInvitation(db, user.id, daysValid) } as const;
  });
}

export function listInvitationsByCreator(createdBy: string): InvitationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, code_prefix, expires_at, used_by, used_at, created_at
       FROM invitations WHERE created_by = ?
       ORDER BY created_at DESC`
    )
    .all(createdBy) as InvitationRow[];
  return rows.map((row) => ({
    id: row.id,
    code_prefix: row.code_prefix,
    expires_at: row.expires_at,
    used_by: row.used_by,
    used_at: row.used_at,
    created_at: row.created_at
  }));
}

export function listInvitees(createdBy: string): InviteeRow[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.display_name, u.avatar_emoji, i.used_at, i.code_prefix
       FROM invitations i
       JOIN users u ON u.id = i.used_by
       WHERE i.created_by = ? AND i.used_by IS NOT NULL
       ORDER BY i.used_at DESC`
    )
    .all(createdBy) as Array<{
    id: string;
    display_name: string;
    avatar_emoji: string;
    used_at: string;
    code_prefix: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    joinedAt: row.used_at,
    invitePrefix: row.code_prefix
  }));
}

export function listAllInvitationsForOwner(): AdminInvitationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.code_prefix, i.expires_at, i.used_by, i.used_at, i.created_at,
              creator.display_name AS creator_name,
              guest.display_name AS used_by_name
       FROM invitations i
       JOIN users creator ON creator.id = i.created_by
       LEFT JOIN users guest ON guest.id = i.used_by
       ORDER BY i.created_at DESC`
    )
    .all() as Array<
    InvitationRow & { creator_name: string; used_by_name: string | null }
  >;
  return rows.map((row) => ({
    id: row.id,
    code_prefix: row.code_prefix,
    expires_at: row.expires_at,
    used_by: row.used_by,
    used_at: row.used_at,
    created_at: row.created_at,
    creatorName: row.creator_name,
    usedByName: row.used_by_name
  }));
}
