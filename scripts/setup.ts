import { randomUUID } from "node:crypto";
import { getDb } from "../lib/db";
import { hashPassword, randomToken } from "../lib/security";
import { createInvitation } from "../lib/invites";

async function main() {

const email = (process.env.MORROW_OWNER_EMAIL ?? "owner@morrow.local").toLowerCase();
const displayName = process.env.MORROW_OWNER_NAME ?? "Morrow 发起人";
const password = process.env.MORROW_OWNER_PASSWORD ?? randomToken(12);

const db = getDb();
const existing = db
  .prepare("SELECT id, email FROM users WHERE role = 'owner' LIMIT 1")
  .get() as { id: string; email: string } | undefined;

let ownerId = existing?.id;
if (!ownerId) {
  ownerId = randomUUID();
  const secret = hashPassword(password);
  db.prepare(
    `INSERT INTO users
      (id, email, password_hash, password_salt, display_name, avatar_emoji,
       role, email_verified, accepted_covenant, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, '🌱', 'owner', 1, 1, ?, ?)`
  ).run(
    ownerId,
    email,
    secret.hash,
    secret.salt,
    displayName,
    new Date().toISOString(),
    new Date().toISOString()
  );
  console.log("Owner account created.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log("Change this password before sharing the site.");
} else {
  console.log(`Owner already exists: ${existing?.email ?? email}`);
}

const activeInvite = db
  .prepare(
    "SELECT id FROM invitations WHERE used_by IS NULL AND expires_at > ? LIMIT 1"
  )
  .get(new Date().toISOString()) as { id: string } | undefined;
if (!activeInvite) {
  const invitation = createInvitation(ownerId, 7);
  console.log(`One-time invite: ${invitation.code}`);
  console.log(`Register at: ${process.env.MORROW_APP_URL ?? "http://localhost:3000"}/register?code=${invitation.code}`);
} else {
  console.log("An unused invitation already exists. Generate another in /admin/invites.");
}
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
