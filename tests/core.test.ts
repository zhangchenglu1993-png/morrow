import test from "node:test";
import assert from "node:assert/strict";
import { calculateVisibility, shouldHideComment } from "../lib/feedback.js";
import { majorVoteWeight, rankForPoints, RANKS } from "../lib/ranks.js";
import { promptForDay } from "../lib/prompts.js";
import { hashPassword, verifyPassword } from "../lib/security.js";

test("hiding requires at least 10 feedback participants", () => {
  const nineNegative = Array.from({ length: 9 }, (_, index) => ({
    userId: `u${index}`,
    reaction: "cry" as const,
    flagged: false
  }));
  assert.equal(calculateVisibility(nineNegative, 10, 0.2).shouldHide, false);
});

test("10 participants with exactly 20% negative hides", () => {
  const entries = Array.from({ length: 10 }, (_, index) => ({
    userId: `u${index}`,
    reaction: index < 2 ? ("cry" as const) : ("smile" as const),
    flagged: false
  }));
  const result = calculateVisibility(entries, 10, 0.2);
  assert.equal(result.participants, 10);
  assert.equal(result.negative, 2);
  assert.equal(result.shouldHide, true);
});

test("15 participants with 3 negative hides, but 2 does not", () => {
  const make = (negative: number) =>
    Array.from({ length: 15 }, (_, index) => ({
      userId: `u${index}`,
      reaction: index < negative ? ("cry" as const) : ("love" as const),
      flagged: false
    }));
  assert.equal(calculateVisibility(make(3), 10, 0.2).shouldHide, true);
  assert.equal(calculateVisibility(make(2), 10, 0.2).shouldHide, false);
});

test("duplicate reactions do not inflate participant count", () => {
  const entries = Array.from({ length: 20 }, () => ({
    userId: "same-user",
    reaction: "cry" as const,
    flagged: false
  }));
  assert.equal(calculateVisibility(entries, 10, 0.2).participants, 1);
  assert.equal(calculateVisibility(entries, 10, 0.2).shouldHide, false);
});

test("a flag is negative even when the reaction is positive", () => {
  const result = calculateVisibility(
    [
      { userId: "a", reaction: "smile", flagged: true },
      ...Array.from({ length: 9 }, (_, index) => ({
        userId: `u${index}`,
        reaction: "love" as const,
        flagged: false
      }))
    ],
    10,
    0.2
  );
  assert.equal(result.negative, 1);
  assert.equal(result.shouldHide, false);
});

test("comment hidden after threshold flags", () => {
  assert.equal(shouldHideComment(4, 5), false);
  assert.equal(shouldHideComment(5, 5), true);
});

test("rank boundaries map to the Qin titles", () => {
  assert.equal(rankForPoints(0).current.title, "公士");
  assert.equal(rankForPoints(29).current.title, "公士");
  assert.equal(rankForPoints(30).current.title, "上造");
  assert.equal(rankForPoints(3990).current.title, "彻侯");
  assert.equal(rankForPoints(9999).current.level, RANKS.length);
  assert.equal(majorVoteWeight(18), 1);
  assert.equal(majorVoteWeight(19), 2);
  assert.equal(majorVoteWeight(20), 3);
});

test("daily prompts cycle every 30 days", () => {
  assert.equal(promptForDay(1).day, 1);
  assert.deepEqual(promptForDay(31), promptForDay(1));
  assert.deepEqual(promptForDay(30), promptForDay(30));
});

test("password hashes verify correctly", () => {
  const { hash, salt } = hashPassword("a-safe-password");
  assert.equal(verifyPassword("a-safe-password", hash, salt), true);
  assert.equal(verifyPassword("wrong-password", hash, salt), false);
});
