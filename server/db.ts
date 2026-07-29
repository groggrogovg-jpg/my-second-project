import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id            VARCHAR PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      nano2_cards   INTEGER NOT NULL DEFAULT 0,
      nano2_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pro_cards     INTEGER NOT NULL DEFAULT 0,
      pro_expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      stars_balance INTEGER NOT NULL DEFAULT 0,
      trial_nano2_used  BOOLEAN NOT NULL DEFAULT FALSE,
      trial_nano2_count INTEGER NOT NULL DEFAULT 0,
      trial_pro_used    BOOLEAN NOT NULL DEFAULT FALSE,
      trial_tryon_used  BOOLEAN NOT NULL DEFAULT FALSE,
      is_developer  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payments (
      label         TEXT PRIMARY KEY,
      stars_to_add  INTEGER NOT NULL DEFAULT 0,
      cards_included INTEGER NOT NULL DEFAULT 0,
      model_type    TEXT NOT NULL DEFAULT '',
      operation_id  TEXT NOT NULL DEFAULT '',
      amount        TEXT NOT NULL DEFAULT '0',
      confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
      credited      BOOLEAN NOT NULL DEFAULT FALSE,
      username      TEXT NOT NULL DEFAULT '',
      user_id       VARCHAR,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("[db] tables ready: app_users, payments");
}
