import type { ReactionType } from "./constants";

export type FeedbackEntry = {
  userId: string;
  reaction: ReactionType | null;
  flagged: boolean;
};

export type VisibilitySnapshot = {
  participants: number;
  negative: number;
  ratio: number;
  shouldHide: boolean;
};

export function calculateVisibility(
  entries: FeedbackEntry[],
  minParticipants: number,
  hideRatio: number
): VisibilitySnapshot {
  const unique = new Map<string, FeedbackEntry>();
  for (const entry of entries) unique.set(entry.userId, entry);
  const values = [...unique.values()];
  const negative = values.filter(
    (entry) => entry.reaction === "cry" || entry.flagged
  ).length;
  const ratio = values.length === 0 ? 0 : negative / values.length;
  return {
    participants: values.length,
    negative,
    ratio,
    shouldHide: values.length >= minParticipants && ratio >= hideRatio
  };
}

export function shouldHideComment(flags: number, threshold: number): boolean {
  return flags >= threshold;
}
