import { findDueReminders, sendGatheringReminders } from "../lib/reminders";

async function main() {
  if (process.argv.includes("--dry-run")) {
    const due = findDueReminders();
    console.log(`DUE=${due.length}`);
    for (const item of due) {
      console.log(`${item.kind} ${item.email} ${item.startsAt} ${item.title}`);
    }
    return;
  }

  const result = await sendGatheringReminders();
  console.log(`SENT=${result.sent} FAILED=${result.failed}`);
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
