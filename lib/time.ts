export const APP_TIME_ZONE = "Asia/Shanghai";

export function shanghaiDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function daysSince(isoDate: string, now = new Date()): number {
  const start = new Date(isoDate);
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
