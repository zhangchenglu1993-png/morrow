import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  dayKeyOf,
  monthBounds,
  monthLabel,
  relativeDayLabel,
  shanghaiMonthKey,
  shiftMonth
} from "@/lib/calendar";
import {
  listGatheringsBetween,
  listMyPendingMemories,
  listMyUpcomingGatherings,
  type GatheringView
} from "@/lib/gatherings";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function countdownLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天后`;
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  const monthKey = /^\d{4}-\d{2}$/.test(query.month ?? "")
    ? (query.month as string)
    : shanghaiMonthKey();
  const bounds = monthBounds(monthKey);
  const events = listGatheringsBetween(bounds.startIso, bounds.endIso, user.id);

  const byDay = new Map<string, GatheringView[]>();
  for (const event of events) {
    const key = dayKeyOf(event.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const today = dayKeyOf(new Date());
  const defaultDay = today.startsWith(monthKey)
    ? today
    : events[0]
      ? dayKeyOf(events[0].startsAt)
      : `${monthKey}-01`;
  const selectedDay =
    query.day && query.day.startsWith(monthKey) ? query.day : defaultDay;
  const selectedEvents = byDay.get(selectedDay) ?? [];

  const todos = listMyUpcomingGatherings(user.id);
  const pending = listMyPendingMemories(user.id);

  const cells: Array<{ day?: number; key?: string }> = [];
  for (let index = 0; index < bounds.firstWeekday; index += 1) cells.push({});
  for (let day = 1; day <= bounds.days; day += 1) {
    const key = `${monthKey}-${String(day).padStart(2, "0")}`;
    cells.push({ day, key });
  }
  while (cells.length % 7 !== 0) cells.push({});

  return (
    <div className="narrow-page">
      <p className="page-kicker">Calendar</p>
      <h1 className="page-title">日历</h1>
      <p className="page-subtitle">
        大家约好的小事都在这里。你报名的事情会自动变成待办，并在开始前提醒你。
      </p>

      <section className="proposal-card" aria-labelledby="todos-title">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">To do</p>
            <h2 id="todos-title" style={{ margin: 0, fontFamily: "var(--serif)", fontSize: "1.35rem" }}>
              接下来要做的事
            </h2>
          </div>
          <Link href="/together">发起一件小事 →</Link>
        </div>
        {todos.length > 0 ? (
          <ul className="todo-list">
            {todos.slice(0, 8).map((gathering) => (
              <li key={gathering.id}>
                <Link className="todo-item" href="/together">
                  <span className={`todo-when${daysUntil(gathering.startsAt) <= 1 ? " soon" : ""}`}>
                    {countdownLabel(gathering.startsAt)}
                  </span>
                  <span className="todo-body">
                    <strong>{gathering.title}</strong>
                    <small>
                      {formatDateTime(gathering.startsAt)}
                      {gathering.place ? ` · ${gathering.place}` : ""} ·{" "}
                      {gathering.attendees.length} 人会去
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">接下来还没有约定。去「一起」看看，或者自己发起一件小事。</p>
        )}
        {pending.length > 0 ? (
          <div className="todo-pending">
            <strong>该留下记录了</strong>
            {pending.map((gathering) => (
              <Link key={gathering.id} href="/together">
                {gathering.title} · {formatDateTime(gathering.startsAt)}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="proposal-card" aria-labelledby="month-title">
        <div className="calendar-head">
          <div>
            <p className="eyebrow">Month</p>
            <h2 id="month-title">{monthLabel(monthKey)}</h2>
          </div>
          <div className="calendar-nav">
            <Link href={`/calendar?month=${shiftMonth(monthKey, -1)}`} aria-label="上个月">
              ←
            </Link>
            <Link href="/calendar">今天</Link>
            <Link href={`/calendar?month=${shiftMonth(monthKey, 1)}`} aria-label="下个月">
              →
            </Link>
          </div>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {cells.map((cell, index) => {
            if (!cell.key) {
              return <span className="calendar-cell empty" key={`empty-${index}`} />;
            }
            const dayEvents = byDay.get(cell.key) ?? [];
            const isToday = cell.key === today;
            const isSelected = cell.key === selectedDay;
            return (
              <Link
                className={`calendar-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}${dayEvents.length > 0 ? " has-events" : ""}`}
                href={`/calendar?month=${monthKey}&day=${cell.key}`}
                key={cell.key}
              >
                <span className="calendar-day">{cell.day}</span>
                {dayEvents.slice(0, 2).map((event) => (
                  <span className="calendar-chip" key={event.id}>
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="calendar-more">+{dayEvents.length - 2}</span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="calendar-day-panel">
          <h3>{relativeDayLabel(selectedDay)}</h3>
          {selectedEvents.length > 0 ? (
            <ul className="calendar-events">
              {selectedEvents.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>
                      {formatDateTime(event.startsAt)}
                      {event.place ? ` · ${event.place}` : ""}
                    </span>
                    <small>
                      {event.author.avatarEmoji} {event.author.displayName} 发起 ·{" "}
                      {event.attendees.length} 人会去
                      {event.isAttending ? " · 我也去" : ""}
                    </small>
                  </div>
                  <Link className="button button-ghost button-small" href="/together">
                    查看
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">这一天还没有约定。</p>
          )}
        </div>
      </section>
    </div>
  );
}
