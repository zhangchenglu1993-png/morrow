import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DAILY_PROMPTS } from "./prompts";
import { shanghaiDayKey } from "./time";

type GlobalWithDb = typeof globalThis & {
  __morrowDb?: DatabaseSync;
};

const globalWithDb = globalThis as GlobalWithDb;

export function databasePath(): string {
  return process.env.MORROW_DB_PATH ?? path.join(process.cwd(), "data", "morrow.db");
}

function createDb(): DatabaseSync {
  const dbPath = databasePath();
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_emoji TEXT NOT NULL DEFAULT '🌱',
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      accepted_covenant INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used_by TEXT REFERENCES users(id),
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      csrf_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL DEFAULT '',
      prompt_day INTEGER,
      status TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public', 'hidden', 'deleted')),
      created_at TEXT NOT NULL,
      hidden_at TEXT
    );
    CREATE INDEX IF NOT EXISTS posts_public_created_idx
      ON posts(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      storage_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS media_post_idx ON media_assets(post_id);

    CREATE TABLE IF NOT EXISTS reactions (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('love', 'smile', 'calm', 'cry')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_flags (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reasons TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'public' CHECK (status IN ('public', 'hidden', 'deleted')),
      created_at TEXT NOT NULL,
      hidden_at TEXT
    );
    CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, created_at);

    CREATE TABLE IF NOT EXISTS comment_flags (
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS daily_prompts (
      day_number INTEGER PRIMARY KEY,
      theme TEXT NOT NULL,
      question TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contribution_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      source_id TEXT NOT NULL,
      post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
      points INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, kind, source_id)
    );
    CREATE INDEX IF NOT EXISTS contribution_user_idx
      ON contribution_events(user_id, active, created_at);
    CREATE INDEX IF NOT EXISTS contribution_post_idx
      ON contribution_events(post_id);

    CREATE TABLE IF NOT EXISTS featured_entries (
      day_key TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      positive_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('normal', 'major')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'collecting'
        CHECK (status IN ('collecting', 'discussion', 'voting', 'passed', 'rejected')),
      setting_key TEXT,
      setting_value TEXT,
      discussion_ends_at TEXT,
      vote_ends_at TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
    CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS proposal_endorsements (
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (proposal_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS proposal_comments (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposal_votes (
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      choice TEXT NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
      weight INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      PRIMARY KEY (proposal_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const promptInsert = db.prepare(
    "INSERT OR IGNORE INTO daily_prompts (day_number, theme, question) VALUES (?, ?, ?)"
  );
  for (const prompt of DAILY_PROMPTS) {
    promptInsert.run(prompt.day, prompt.theme, prompt.question);
  }

  const launchDate = db
    .prepare("SELECT value FROM settings WHERE key = 'launch_date'")
    .get() as { value: string } | undefined;
  if (!launchDate) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('launch_date', ?)").run(
      shanghaiDayKey()
    );
  }

  const defaults: Array<[string, string]> = [
    ["min_feedback_participants", "10"],
    ["negative_hide_ratio", "0.2"],
    ["comment_hide_flags", "5"],
    ["daily_contribution_cap", "60"]
  ];
  const settingInsert = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  for (const [key, value] of defaults) settingInsert.run(key, value);

  return db;
}

export function getDb(): DatabaseSync {
  if (!globalWithDb.__morrowDb) {
    globalWithDb.__morrowDb = createDb();
  }
  return globalWithDb.__morrowDb;
}

export function withTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getSettingNumber(key: string, fallback: number): number {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  const parsed = row ? Number(row.value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
