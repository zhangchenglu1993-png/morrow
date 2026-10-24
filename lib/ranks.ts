export type Rank = {
  level: number;
  title: string;
  threshold: number;
  privilege: string | null;
};

export const RANKS: Rank[] = [
  { level: 1, title: "公士", threshold: 0, privilege: null },
  { level: 2, title: "上造", threshold: 30, privilege: null },
  { level: 3, title: "簪袅", threshold: 80, privilege: null },
  { level: 4, title: "不更", threshold: 150, privilege: null },
  { level: 5, title: "大夫", threshold: 240, privilege: null },
  { level: 6, title: "官大夫", threshold: 350, privilege: null },
  { level: 7, title: "公大夫", threshold: 480, privilege: null },
  { level: 8, title: "公乘", threshold: 630, privilege: null },
  { level: 9, title: "五大夫", threshold: 800, privilege: null },
  { level: 10, title: "左庶长", threshold: 990, privilege: null },
  { level: 11, title: "右庶长", threshold: 1200, privilege: null },
  { level: 12, title: "左更", threshold: 1430, privilege: null },
  { level: 13, title: "中更", threshold: 1680, privilege: null },
  { level: 14, title: "右更", threshold: 1950, privilege: null },
  { level: 15, title: "少上造", threshold: 2240, privilege: null },
  { level: 16, title: "大上造", threshold: 2550, privilege: "可单独发起普通规则提案" },
  { level: 17, title: "驷车庶长", threshold: 2880, privilege: "可主持规则讨论" },
  { level: 18, title: "大庶长", threshold: 3230, privilege: "可发起重大方向投票" },
  { level: 19, title: "关内侯", threshold: 3600, privilege: "重大方向投票权重 ×2" },
  { level: 20, title: "彻侯", threshold: 3990, privilege: "重大方向投票权重 ×3" }
];

export type RankState = {
  current: Rank;
  next: Rank | null;
  progress: number;
  pointsToNext: number;
};

export function rankForPoints(points: number): RankState {
  const safePoints = Number.isFinite(points) ? Math.max(0, points) : 0;
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (safePoints >= rank.threshold) current = rank;
  }
  const next = RANKS.find((rank) => rank.threshold > current.threshold) ?? null;
  const span = next ? next.threshold - current.threshold : 1;
  const earned = safePoints - current.threshold;
  return {
    current,
    next,
    progress: next ? Math.min(1, Math.max(0, earned / span)) : 1,
    pointsToNext: next ? Math.max(0, next.threshold - safePoints) : 0
  };
}

export function majorVoteWeight(level: number): number {
  if (level >= 20) return 3;
  if (level >= 19) return 2;
  return 1;
}
