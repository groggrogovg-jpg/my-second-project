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
      email_verified   BOOLEAN NOT NULL DEFAULT TRUE,
      email_verification_token_hash TEXT,
      email_verification_expires_at TIMESTAMPTZ,
      email_verification_sent_at TIMESTAMPTZ,
      is_developer  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

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

    CREATE TABLE IF NOT EXISTS admin_star_transactions (
      id           UUID PRIMARY KEY,
      user_id      VARCHAR NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      amount       INTEGER NOT NULL CHECK (amount > 0),
      type         TEXT NOT NULL DEFAULT 'admin_added',
      admin_label  TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_admin_star_transactions_user_created
      ON admin_star_transactions (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS "session" (
      sid    VARCHAR NOT NULL COLLATE "default",
      sess   JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )
    WITH (OIDS=FALSE);

    ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY (sid);
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" (expire);

    CREATE TABLE IF NOT EXISTS support_chats (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            VARCHAR,
      telegram_user_id   TEXT NOT NULL,
      user_name          TEXT NOT NULL DEFAULT '',
      last_message       TEXT,
      last_activity      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status             TEXT NOT NULL DEFAULT 'open',
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE support_chats ADD COLUMN IF NOT EXISTS user_name TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_support_chats_telegram_user
      ON support_chats (telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_support_chats_activity
      ON support_chats (last_activity DESC);

    CREATE TABLE IF NOT EXISTS support_messages (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id             UUID NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
      telegram_user_id    TEXT,
      message             TEXT NOT NULL,
      telegram_update_id  TEXT,
      is_from_user        BOOLEAN NOT NULL DEFAULT TRUE,
      is_read             BOOLEAN NOT NULL DEFAULT FALSE,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS telegram_update_id TEXT;
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_from_user BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_update
      ON support_messages (telegram_update_id)
      WHERE telegram_update_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_support_messages_chat_created
      ON support_messages (chat_id, created_at);
  `);
  console.log("[db] tables ready: app_users, payments, support");
}
