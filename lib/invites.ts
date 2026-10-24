import { randomInt, randomUUID } from "node:crypto";
import { getDb, withTransaction } from "./db";
import { hashToken } from "./security";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomGroup(length: number): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function createInvitation(
  createdBy: string,
  daysValid = 7
): { code: string; id: string; expiresAt: string } {
  const raw = `MORROW-${randomGroup(4)}-${randomGroup(4)}`;
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysValid * 86_400_000);
  getDb()
    .prepare(
      `INSERT INTO invitations
        (id, code_hash, code_prefix, created_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, hashToken(raw), raw.slice(0, 11), createdBy, expiresAt.toISOString(), now.toISOString());
  return { code: raw, id, expiresAt: expiresAt.toISOString() };
}

export type InvitationRow = {
  id: string;
  code_prefix: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

export function findInvitation(code: string): InvitationRow | null {
  const row = getDb()
    .prepare(
      `SELECT id, code_prefix, expires_at, used_by, used_at, created_at
       FROM invitations WHERE code_hash = ?`
    )
    .get(hashToken(normalizeInviteCode(code))) as InvitationRow | undefined;
  return row ?? null;
}

export function consumeInvitation(code: string, userId: string): boolean {
  return withTransaction((db) => {
    const row = db
      .prepare(
        `SELECT id, expires_at, used_by FROM invitations WHERE code_hash = ?`
      )
      .get(hashToken(normalizeInviteCode(code))) as
      | { id: string; expires_at: string; used_by: string | null }
      | undefined;
    if (!row || row.used_by || new Date(row.expires_at).getTime() <= Date.now()) {
      return false;
    }
    db.prepare(
      "UPDATE invitations SET used_by = ?, used_at = ? WHERE id = ? AND used_by IS NULL"
    ).run(userId, new Date().toISOString(), row.id);
    return true;
  });
}

export function listInvitations(): InvitationRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, code_prefix, expires_at, used_by, used_at, created_at
       FROM invitations ORDER BY created_at DESC`
    )
    .all() as InvitationRow[];
  return rows.map((row) => ({
    id: row.id,
    code_prefix: row.code_prefix,
    expires_at: row.expires_at,
    used_by: row.used_by,
    used_at: row.used_at,
    created_at: row.created_at
  }));
}
