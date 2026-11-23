import { APP_TIME_ZONE } from "./time";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function shanghaiMonthKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).format(date);
}

export function dayKeyOf(value: string | Date): string {
  return dayFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12 + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthBounds(monthKey: string): {
  startIso: string;
  endIso: string;
  days: number;
  firstWeekday: number;
} {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(`${monthKey}-01T00:00:00+08:00`);
  const nextMonth = shiftMonth(monthKey, 1);
  const end = new Date(`${nextMonth}-01T00:00:00+08:00`);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(`${monthKey}-01T12:00:00+08:00`).getDay() + 6) % 7;
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    days,
    firstWeekday
  };
}

export function relativeDayLabel(value: string | Date): string {
  const target = dayKeyOf(value);
  const today = dayKeyOf(new Date());
  if (target === today) return "今天";
  const tomorrow = dayKeyOf(new Date(Date.now() + 86_400_000));
  if (target === tomorrow) return "明天";
  const [, month, day] = target.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}
