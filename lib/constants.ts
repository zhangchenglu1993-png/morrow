export const APP_NAME = "Morrow";
export const APP_NAME_CN = "点滴美好";
export const APP_TAGLINE_EN = "Small joys, kept for tomorrow.";
export const APP_TAGLINE_CN = "把今天的美好，留给明天。";

export const REACTIONS = [
  { type: "love", emoji: "😍", label: "喜欢", tone: "positive" },
  { type: "smile", emoji: "😊", label: "开心", tone: "positive" },
  { type: "calm", emoji: "😌", label: "平静", tone: "neutral" },
  { type: "cry", emoji: "😢", label: "难过", tone: "negative" }
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

export const REACTION_TYPES = REACTIONS.map((reaction) => reaction.type) as ReactionType[];

export const FEEDBACK_REASONS = [
  { value: "ai", label: "AI 生成" },
  { value: "fake", label: "虚假或虚构" },
  { value: "illegal", label: "违法或暴力" },
  { value: "negative", label: "负面内容" }
] as const;

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["value"];

export const DEFAULT_RULES = {
  minFeedbackParticipants: 10,
  negativeHideRatio: 0.2,
  commentHideFlags: 5,
  dailyContributionCap: 60,
  feedPageSize: 24
} as const;

export const COVENANT_ITEMS = [
  "我只发布自己的真实生活。",
  "我不使用 AI 生成文字、图片或视频。",
  "我尊重他人的隐私和肖像。",
  "我不发布广告、新闻、政治或负面内容。",
  "我愿意接受成员共同反馈，也愿意参与共同维护。"
] as const;
