export type ProposalKind = "normal" | "major";
export type ProposalStatus = "collecting" | "discussion" | "voting" | "passed" | "rejected";
export type VoteChoice = "yes" | "no" | "abstain";

export const SETTING_OPTIONS = [
  {
    key: "min_feedback_participants",
    label: "内容隐藏所需的最少反馈人数",
    type: "integer",
    min: 1,
    max: 100
  },
  {
    key: "negative_hide_ratio_percent",
    label: "内容隐藏所需的负向反馈百分比",
    type: "integer",
    min: 5,
    max: 90
  },
  {
    key: "comment_hide_flags",
    label: "评论隐藏所需的反馈人数",
    type: "integer",
    min: 1,
    max: 50
  },
  {
    key: "daily_contribution_cap",
    label: "每日有效贡献值上限",
    type: "integer",
    min: 10,
    max: 500
  }
] as const;

export type SettingKey = (typeof SETTING_OPTIONS)[number]["key"];

export type ProposalView = {
  id: string;
  kind: ProposalKind;
  title: string;
  body: string;
  status: ProposalStatus;
  author: {
    id: string;
    displayName: string;
    avatarEmoji: string;
    level: number;
    title: string;
  };
  settingKey: SettingKey | null;
  settingValue: string | null;
  discussionEndsAt: string | null;
  voteEndsAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  endorsements: number;
  requiredEndorsements: number;
  myEndorsement: boolean;
  votes: { yes: number; no: number; abstain: number; voters: number };
  myVote: VoteChoice | null;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorEmoji: string;
  }>;
};
