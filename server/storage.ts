import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { randomUUID, createHash } from "crypto";
import { pool } from "./db";

// Полный аккаунт пользователя на сервере (расширяет User)
// Примечание: username хранит адрес email — единственный идентификатор аккаунта.
export interface ModelSubscription {
  cards: number;
  expiresAt: Date;
}

export interface AppUser extends User {
  passwordHash: string;
  email: string;
  nano2Balance: number;
  proBalance: number;
  starsBalance: number;
  nano2Subscription: ModelSubscription;
  proSubscription: ModelSubscription;
  trialNano2Used: boolean;
  trialNano2Count: number;
  trialProUsed: boolean;
  trialTryonUsed: boolean;
  emailVerified: boolean;
  isDeveloper: boolean;
  createdAt: Date;
}

export type TrialFeature = "nano2" | "pro" | "tryon";

const PACKAGE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function isExpired(expiresAt: Date): boolean {
  return new Date().getTime() > new Date(expiresAt).getTime();
}

export function effectiveCards(sub: ModelSubscription): number {
  return isExpired(sub.expiresAt) ? 0 : Math.max(0, sub.cards);
}

export function syncModelBalances(user: AppUser): void {
  user.nano2Balance = effectiveCards(user.nano2Subscription);
  user.proBalance = effectiveCards(user.proSubscription);
}

export interface PaymentRecord {
  label: string;
  starsToAdd: number;
  cardsIncluded: number;
  modelType: string;
  operationId: string;
  amount: string;
  confirmed: boolean;
  username: string;
  userId: string | null;
  email: string | null;
  credited: boolean;
  createdAt: Date;
}

export interface ServerUser {
  username: string;
  id: string | null;
  registeredAt: Date;
  generationCount: number;
  pendingNano2: number;
  pendingPro: number;
  nano2Balance: number;
  proBalance: number;
  starsBalance: number;
  isDeveloper: boolean;
}

export interface ErrorLog {
  id: string;
  username: string;
  model: string;
  errorMessage: string;
  generationType: string;
  createdAt: Date;
}

export interface SupportChat {
  id: string;
  userId: string | null;
  telegramUserId: string;
  userName: string;
  lastMessage: string | null;
  lastActivity: Date;
  status: "open" | "closed";
  createdAt: Date;
}

export interface SupportMessage {
  id: string;
  chatId: string;
  telegramUserId: string | null;
  message: string;
  telegramUpdateId: string | null;
  isFromUser: boolean;
  isRead: boolean;
  createdAt: Date;
}

export interface IStorage {
  // Auth
  createAppUser(email: string, passwordHash: string): Promise<AppUser>;
  getAppUserById(id: string): Promise<AppUser | undefined>;
  getAppUserByUsername(username: string): Promise<AppUser | undefined>;
  updateAppUserBalances(id: string, nano2: number, pro: number): Promise<void>;
  updateStarsBalance(id: string, delta: number): Promise<void>;
  deductStars(id: string, amount: number): Promise<AppUser | null>;
  resetUserPassword(username: string, passwordHash: string): Promise<boolean>;
  createEmailVerificationToken(userId: string): Promise<string | null>;
  verifyEmailToken(token: string): Promise<AppUser | undefined>;
  markTrialUsed(id: string, feature: TrialFeature): Promise<void>;
  consumeEntitlement(id: string, feature: TrialFeature): Promise<{ usedTrial: boolean } | null>;
  refundEntitlement(id: string, feature: TrialFeature, usedTrial: boolean): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createGeneration(gen: Omit<InsertGeneration, "id" | "createdAt">): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined>;
  listGenerations(filter: { userId?: string; sessionId?: string }): Promise<Generation[]>;
  transferSessionGenerations(sessionId: string, userId: string): Promise<number>;
  deleteExpiredGenerations(): Promise<number>;
  recordPayment(payment: Omit<PaymentRecord, "confirmed" | "credited" | "createdAt" | "email">): Promise<PaymentRecord>;
  updatePaymentOperationId(label: string, operationId: string): Promise<PaymentRecord | undefined>;
  getPaymentByLabel(label: string): Promise<PaymentRecord | undefined>;
  confirmPayment(label: string): Promise<PaymentRecord | undefined>;
  listPayments(): Promise<PaymentRecord[]>;
  creditConfirmedPayment(label: string, userId: string): Promise<AppUser | null>;
  grantDeveloperCredit(userId: string, nano2: number, pro: number): Promise<AppUser | undefined>;
  creditAppUserBalanceByUsername(username: string, model: "nano2" | "pro", amount: number): Promise<AppUser | undefined>;
  addAdminStars(userId: string, amount: 1 | 5 | 10, adminLabel: string): Promise<AppUser | undefined>;
  trackUser(username: string): Promise<ServerUser>;
  getServerUser(username: string): Promise<ServerUser | undefined>;
  getAllServerUsers(): Promise<ServerUser[]>;
  incrementUserGenerations(username: string): Promise<void>;
  addPendingCredits(username: string, nano2: number, pro: number): Promise<void>;
  consumePendingCredits(username: string): Promise<{ nano2: number; pro: number }>;
  addErrorLog(log: Omit<ErrorLog, "id" | "createdAt">): Promise<ErrorLog>;
  getErrorLogs(): Promise<ErrorLog[]>;
  getOrCreateSupportChat(telegramUserId: string, userId?: string, userName?: string): Promise<SupportChat>;
  getSupportChat(id: string): Promise<SupportChat | undefined>;
  getSupportChatByTelegramId(telegramUserId: string): Promise<SupportChat | undefined>;
  listSupportChats(): Promise<SupportChat[]>;
  updateSupportChatStatus(id: string, status: "open" | "closed"): Promise<SupportChat | undefined>;
  addSupportMessage(msg: Omit<SupportMessage, "id" | "createdAt" | "telegramUpdateId"> & { telegramUpdateId?: string | null }): Promise<SupportMessage>;
  getSupportMessages(chatId: string): Promise<SupportMessage[]>;
  markMessagesRead(chatId: string): Promise<void>;
  countUnreadMessages(chatId: string): Promise<number>;
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: convert a PostgreSQL row → AppUser
// ────────────────────────────────────────────────────────────────────────────
function rowToAppUser(row: Record<string, any>): AppUser {
  const nano2Sub: ModelSubscription = {
    cards: Number(row.nano2_cards ?? 0),
    expiresAt: row.nano2_expires_at ? new Date(row.nano2_expires_at) : new Date(0),
  };
  const proSub: ModelSubscription = {
    cards: Number(row.pro_cards ?? 0),
    expiresAt: row.pro_expires_at ? new Date(row.pro_expires_at) : new Date(0),
  };
  const user: AppUser = {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    email: row.email,
    passwordHash: row.password_hash,
    nano2Balance: 0,
    proBalance: 0,
    starsBalance: Number(row.stars_balance ?? 0),
    nano2Subscription: nano2Sub,
    proSubscription: proSub,
    trialNano2Used: Boolean(row.trial_nano2_used),
    trialNano2Count: Number(row.trial_nano2_count ?? 0),
    trialProUsed: Boolean(row.trial_pro_used),
    trialTryonUsed: Boolean(row.trial_tryon_used),
    emailVerified: row.email_verified !== false,
    isDeveloper: Boolean(row.is_developer),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
  syncModelBalances(user);
  return user;
}

function rowToPayment(row: Record<string, any>): PaymentRecord {
  return {
    label: row.label,
    starsToAdd: Number(row.stars_to_add ?? 0),
    cardsIncluded: Number(row.cards_included ?? 0),
    modelType: row.model_type ?? "",
    operationId: row.operation_id ?? "",
    amount: row.amount ?? "0",
    confirmed: Boolean(row.confirmed),
    credited: Boolean(row.credited),
    username: row.username ?? "",
    userId: row.user_id ?? null,
    email: row.user_email ?? row.email ?? row.username ?? null,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

function rowToSupportChat(row: Record<string, any>): SupportChat {
  return {
    id: String(row.id),
    userId: row.user_id ?? null,
    telegramUserId: String(row.telegram_user_id),
    userName: String(row.user_name ?? row.telegram_user_id ?? ""),
    lastMessage: row.last_message ?? null,
    lastActivity: row.last_activity ? new Date(row.last_activity) : new Date(),
    status: row.status === "closed" ? "closed" : "open",
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

function rowToSupportMessage(row: Record<string, any>): SupportMessage {
  return {
    id: String(row.id),
    chatId: String(row.chat_id),
    telegramUserId: row.telegram_user_id ?? null,
    message: String(row.message ?? ""),
    telegramUpdateId: row.telegram_update_id ?? null,
    isFromUser: Boolean(row.is_from_user),
    isRead: Boolean(row.is_read),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main storage class
// ────────────────────────────────────────────────────────────────────────────
export class MemStorage implements IStorage {
  // Non-persistent in-memory stores (generations, sessions, support, logs)
  private users: Map<string, User>;
  private generations: Map<string, Generation>;
  private serverUsers: Map<string, ServerUser>;
  private errorLogs: ErrorLog[];
  private supportChats: Map<string, SupportChat>;
  private supportMessages: Map<string, SupportMessage>;

  // Admin state (reset on restart — intentional)
  private adminResetTokens: Map<string, Date>;
  adminOverrideCode: string | null;

  // Password reset tokens (short-lived — ok in memory)
  private passwordResetTokens: Map<string, { email: string; expiresAt: Date; used: boolean }>;
  private passwordResetRateLimit: Map<string, Date>;

  constructor() {
    this.users = new Map();
    this.generations = new Map();
    this.serverUsers = new Map();
    this.errorLogs = [];
    this.supportChats = new Map();
    this.supportMessages = new Map();
    this.adminResetTokens = new Map();
    this.adminOverrideCode = null;
    this.passwordResetTokens = new Map();
    this.passwordResetRateLimit = new Map();
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  createPasswordResetToken(email: string): string {
    const rawToken = randomUUID();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    this.passwordResetTokens.set(tokenHash, { email: email.toLowerCase(), expiresAt, used: false });
    return rawToken;
  }

  canRequestPasswordReset(email: string): boolean {
    const normalized = email.toLowerCase();
    const last = this.passwordResetRateLimit.get(normalized);
    if (!last) return true;
    return Date.now() - last.getTime() >= 5 * 60 * 1000;
  }

  markPasswordResetRequested(email: string): void {
    this.passwordResetRateLimit.set(email.toLowerCase(), new Date());
  }

  peekPasswordResetToken(token: string): string | null {
    const tokenHash = this.hashToken(token);
    const entry = this.passwordResetTokens.get(tokenHash);
    if (!entry) return null;
    if (entry.used || new Date() > entry.expiresAt) {
      this.passwordResetTokens.delete(tokenHash);
      return null;
    }
    return entry.email;
  }

  consumePasswordResetToken(token: string): string | null {
    const tokenHash = this.hashToken(token);
    const entry = this.passwordResetTokens.get(tokenHash);
    if (!entry) return null;
    if (entry.used || new Date() > entry.expiresAt) {
      this.passwordResetTokens.delete(tokenHash);
      return null;
    }
    entry.used = true;
    return entry.email;
  }

  generateAdminResetToken(): string {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    this.adminResetTokens.set(token, expiresAt);
    return token;
  }

  validateAdminResetToken(token: string): boolean {
    const expiresAt = this.adminResetTokens.get(token);
    if (!expiresAt) return false;
    if (new Date() > expiresAt) {
      this.adminResetTokens.delete(token);
      return false;
    }
    return true;
  }

  consumeAdminResetToken(token: string, newCode: string): boolean {
    if (!this.validateAdminResetToken(token)) return false;
    this.adminResetTokens.delete(token);
    this.adminOverrideCode = newCode;
    return true;
  }

  // ── AppUser (PostgreSQL) ────────────────────────────────────────────────

  async createAppUser(email: string, passwordHash: string): Promise<AppUser> {
    const id = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    await pool.query(
      `INSERT INTO app_users
        (id, username, email, password_hash, nano2_cards, nano2_expires_at,
         pro_cards, pro_expires_at, stars_balance,
         trial_nano2_used, trial_nano2_count, trial_pro_used, trial_tryon_used,
         email_verified, is_developer, created_at)
       VALUES ($1,$2,$3,$4,0,$5,0,$5,0,FALSE,0,FALSE,FALSE,FALSE,FALSE,$5)`,
      [id, normalizedEmail, normalizedEmail, passwordHash, now]
    );
    return rowToAppUser({
      id, username: normalizedEmail, email: normalizedEmail, password_hash: passwordHash,
      nano2_cards: 0, nano2_expires_at: now, pro_cards: 0, pro_expires_at: now,
      stars_balance: 0, trial_nano2_used: false, trial_nano2_count: 0,
      trial_pro_used: false, trial_tryon_used: false, is_developer: false, created_at: now,
      email_verified: false,
    });
  }

  async getAppUserById(id: string): Promise<AppUser | undefined> {
    const res = await pool.query("SELECT * FROM app_users WHERE id = $1", [id]);
    if (!res.rows[0]) return undefined;
    return rowToAppUser(res.rows[0]);
  }

  async getAppUserByUsername(username: string): Promise<AppUser | undefined> {
    const res = await pool.query(
      "SELECT * FROM app_users WHERE LOWER(username) = LOWER($1)", [username]
    );
    if (!res.rows[0]) return undefined;
    return rowToAppUser(res.rows[0]);
  }

  async updateAppUserBalances(id: string, nano2: number, pro: number): Promise<void> {
    const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
    await pool.query(
      `UPDATE app_users SET nano2_cards=$1, nano2_expires_at=$2,
                            pro_cards=$3, pro_expires_at=$2
       WHERE id=$4`,
      [Math.max(0, nano2), expiresAt, Math.max(0, pro), id]
    );
  }

  async updateStarsBalance(id: string, delta: number): Promise<void> {
    await pool.query(
      `UPDATE app_users SET stars_balance = GREATEST(0, stars_balance + $1) WHERE id = $2`,
      [delta, id]
    );
  }

  async deductStars(id: string, amount: number): Promise<AppUser | null> {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const result = await pool.query(
      `UPDATE app_users
       SET stars_balance = stars_balance - $1
       WHERE id = $2 AND stars_balance >= $1
       RETURNING *`,
      [amount, id]
    );
    return result.rows[0] ? rowToAppUser(result.rows[0]) : null;
  }

  async consumeEntitlement(id: string, feature: TrialFeature): Promise<{ usedTrial: boolean } | null> {
    const user = await this.getAppUserById(id);
    if (!user) return null;

    if (feature === "nano2") {
      if (effectiveCards(user.nano2Subscription) > 0) {
        await pool.query("UPDATE app_users SET nano2_cards = nano2_cards - 1 WHERE id = $1", [id]);
        return { usedTrial: false };
      }
      if (!user.emailVerified) return null;
      if (!user.trialNano2Used) {
        await pool.query(
          "UPDATE app_users SET trial_nano2_used=TRUE, trial_nano2_count=GREATEST(1,trial_nano2_count) WHERE id=$1",
          [id]
        );
        return { usedTrial: true };
      }
      if (user.trialNano2Count < 2) {
        await pool.query("UPDATE app_users SET trial_nano2_count = trial_nano2_count + 1 WHERE id=$1", [id]);
        return { usedTrial: true };
      }
      return null;
    }

    if (feature === "pro") {
      if (effectiveCards(user.proSubscription) > 0) {
        await pool.query("UPDATE app_users SET pro_cards = pro_cards - 1 WHERE id = $1", [id]);
        return { usedTrial: false };
      }
      return null;
    }

    // tryon
    if (effectiveCards(user.nano2Subscription) > 0) {
      await pool.query("UPDATE app_users SET nano2_cards = nano2_cards - 1 WHERE id = $1", [id]);
      return { usedTrial: false };
    }
    if (!user.trialTryonUsed) {
      if (!user.emailVerified) return null;
      await pool.query("UPDATE app_users SET trial_tryon_used=TRUE WHERE id=$1", [id]);
      return { usedTrial: true };
    }
    return null;
  }

  async refundEntitlement(id: string, feature: TrialFeature, usedTrial: boolean): Promise<void> {
    if (usedTrial) {
      if (feature === "nano2") {
        await pool.query(
          `UPDATE app_users SET
             trial_nano2_count = GREATEST(0, trial_nano2_count - 1),
             trial_nano2_used  = (GREATEST(0, trial_nano2_count - 1) > 0)
           WHERE id=$1`,
          [id]
        );
      } else if (feature === "pro") {
        await pool.query("UPDATE app_users SET trial_pro_used=FALSE WHERE id=$1", [id]);
      } else {
        await pool.query("UPDATE app_users SET trial_tryon_used=FALSE WHERE id=$1", [id]);
      }
      return;
    }
    if (feature === "nano2") {
      await pool.query("UPDATE app_users SET nano2_cards = nano2_cards + 1 WHERE id=$1", [id]);
    } else if (feature === "pro") {
      await pool.query("UPDATE app_users SET pro_cards = pro_cards + 1 WHERE id=$1", [id]);
    } else {
      await pool.query("UPDATE app_users SET nano2_cards = nano2_cards + 1 WHERE id=$1", [id]);
    }
  }

  async grantDeveloperCredit(userId: string, nano2: number, pro: number): Promise<AppUser | undefined> {
    const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
    const res = await pool.query(
      `UPDATE app_users SET
         nano2_cards = nano2_cards + $1, nano2_expires_at = $3,
         pro_cards   = pro_cards   + $2, pro_expires_at   = $3,
         is_developer = TRUE
       WHERE id=$4 RETURNING *`,
      [nano2, pro, expiresAt, userId]
    );
    if (!res.rows[0]) return undefined;
    return rowToAppUser(res.rows[0]);
  }

  async creditAppUserBalanceByUsername(username: string, model: "nano2" | "pro", amount: number): Promise<AppUser | undefined> {
    const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
    const col = model === "pro" ? "pro_cards" : "nano2_cards";
    const expCol = model === "pro" ? "pro_expires_at" : "nano2_expires_at";
    const res = await pool.query(
      `UPDATE app_users SET ${col}=${col}+$1, ${expCol}=$2
       WHERE LOWER(username)=LOWER($3) RETURNING *`,
      [amount, expiresAt, username]
    );
    if (!res.rows[0]) return undefined;
    return rowToAppUser(res.rows[0]);
  }

  async addAdminStars(userId: string, amount: 1 | 5 | 10, adminLabel: string): Promise<AppUser | undefined> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `UPDATE app_users
         SET stars_balance = stars_balance + $1
         WHERE id = $2
         RETURNING *`,
        [amount, userId],
      );
      if (!userRes.rows[0]) {
        await client.query("ROLLBACK");
        return undefined;
      }
      await client.query(
        `INSERT INTO admin_star_transactions (id, user_id, amount, type, admin_label)
         VALUES ($1, $2, $3, 'admin_added', $4)`,
        [randomUUID(), userId, amount, adminLabel],
      );
      await client.query("COMMIT");
      return rowToAppUser(userRes.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async resetUserPassword(username: string, passwordHash: string): Promise<boolean> {
    const res = await pool.query(
      "UPDATE app_users SET password_hash=$1 WHERE LOWER(username)=LOWER($2)",
      [passwordHash, username]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async createEmailVerificationToken(userId: string): Promise<string | null> {
    const rawToken = randomUUID();
    const tokenHash = this.hashToken(rawToken);
    const res = await pool.query(
      `UPDATE app_users
       SET email_verification_token_hash=$1,
           email_verification_expires_at=NOW() + INTERVAL '24 hours',
           email_verification_sent_at=NOW()
       WHERE id=$2
         AND email_verified=FALSE
         AND (email_verification_sent_at IS NULL OR email_verification_sent_at <= NOW() - INTERVAL '5 minutes')
       RETURNING id`,
      [tokenHash, userId],
    );
    return res.rows[0] ? rawToken : null;
  }

  async verifyEmailToken(token: string): Promise<AppUser | undefined> {
    if (!token || token.length > 256) return undefined;
    const tokenHash = this.hashToken(token);
    const res = await pool.query(
      `UPDATE app_users
       SET email_verified=TRUE,
           email_verification_token_hash=NULL,
           email_verification_expires_at=NULL,
           email_verification_sent_at=NULL
       WHERE email_verification_token_hash=$1
         AND email_verification_expires_at > NOW()
       RETURNING *`,
      [tokenHash],
    );
    return res.rows[0] ? rowToAppUser(res.rows[0]) : undefined;
  }

  async markTrialUsed(id: string, feature: TrialFeature): Promise<void> {
    if (feature === "nano2") {
      await pool.query("UPDATE app_users SET trial_nano2_used=TRUE WHERE id=$1", [id]);
    } else if (feature === "pro") {
      await pool.query("UPDATE app_users SET trial_pro_used=TRUE WHERE id=$1", [id]);
    } else {
      await pool.query("UPDATE app_users SET trial_tryon_used=TRUE WHERE id=$1", [id]);
    }
  }

  // ── Payments (PostgreSQL) ───────────────────────────────────────────────

  async recordPayment(payment: Omit<PaymentRecord, "confirmed" | "credited" | "createdAt" | "email">): Promise<PaymentRecord> {
    const now = new Date();
    await pool.query(
      `INSERT INTO payments
         (label, stars_to_add, cards_included, model_type, operation_id,
          amount, confirmed, credited, username, user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,$7,$8,$9)
       ON CONFLICT (label) DO NOTHING`,
      [
        payment.label, payment.starsToAdd, payment.cardsIncluded,
        payment.modelType, payment.operationId, payment.amount,
        payment.username, payment.userId ?? null, now,
      ]
    );
    return { ...payment, email: payment.username || null, confirmed: false, credited: false, createdAt: now };
  }

  async updatePaymentOperationId(label: string, operationId: string): Promise<PaymentRecord | undefined> {
    const res = await pool.query(
      "UPDATE payments SET operation_id=$1 WHERE label=$2 RETURNING *",
      [operationId, label]
    );
    if (!res.rows[0]) return undefined;
    return rowToPayment(res.rows[0]);
  }

  async getPaymentByLabel(label: string): Promise<PaymentRecord | undefined> {
    const res = await pool.query("SELECT * FROM payments WHERE label=$1", [label]);
    if (!res.rows[0]) return undefined;
    return rowToPayment(res.rows[0]);
  }

  async confirmPayment(label: string): Promise<PaymentRecord | undefined> {
    const res = await pool.query(
      "UPDATE payments SET confirmed=TRUE WHERE label=$1 RETURNING *",
      [label]
    );
    if (!res.rows[0]) return undefined;
    return rowToPayment(res.rows[0]);
  }

  async listPayments(): Promise<PaymentRecord[]> {
    const res = await pool.query(
      `SELECT p.*, COALESCE(u.email, p.username) AS user_email
       FROM payments p
       LEFT JOIN app_users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`,
    );
    return res.rows.map(rowToPayment);
  }

  async creditConfirmedPayment(label: string, userId: string): Promise<AppUser | null> {
    // Resolve the actual user: try by ID first, then by username from the payment record.
    let resolvedId = userId;
    const userById = await pool.query("SELECT id FROM app_users WHERE id=$1", [userId]);
    if (!userById.rows[0]) {
      // User registered in old MemStorage session — look up by email/username stored in payment
      const payLookup = await pool.query("SELECT username FROM payments WHERE label=$1", [label]);
      const uname = payLookup.rows[0]?.username;
      if (uname) {
        const byName = await pool.query("SELECT id FROM app_users WHERE LOWER(username)=LOWER($1)", [uname]);
        if (byName.rows[0]) resolvedId = byName.rows[0].id;
        else return null; // user truly doesn't exist in PostgreSQL
      } else {
        return null;
      }
    }

    // Lock and credit in one transaction so a process interruption cannot mark
    // a payment as credited without applying its balance.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const payRes = await client.query(
        `UPDATE payments SET credited=TRUE, user_id=$1
         WHERE label=$2 AND confirmed=TRUE AND credited=FALSE
         RETURNING *`,
        [resolvedId, label],
      );
      if (!payRes.rows[0]) {
        await client.query("ROLLBACK");
        return null; // already credited, not confirmed, or not found
      }

      const payment = rowToPayment(payRes.rows[0]);
      const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
      let balanceRes;
      if (payment.cardsIncluded > 0 && payment.modelType === "pro") {
        balanceRes = await client.query(
          `UPDATE app_users SET
             pro_cards = (CASE WHEN pro_expires_at > NOW() THEN pro_cards ELSE 0 END) + $1,
             pro_expires_at = $2,
             stars_balance = stars_balance + $3
           WHERE id=$4`,
          [payment.cardsIncluded, expiresAt, payment.starsToAdd, resolvedId],
        );
      } else if (payment.cardsIncluded > 0) {
        balanceRes = await client.query(
          `UPDATE app_users SET
             nano2_cards = (CASE WHEN nano2_expires_at > NOW() THEN nano2_cards ELSE 0 END) + $1,
             nano2_expires_at = $2,
             stars_balance = stars_balance + $3
           WHERE id=$4`,
          [payment.cardsIncluded, expiresAt, payment.starsToAdd, resolvedId],
        );
      } else {
        balanceRes = await client.query(
          "UPDATE app_users SET stars_balance = stars_balance + $1 WHERE id=$2",
          [payment.starsToAdd, resolvedId],
        );
      }

      if ((balanceRes.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query("COMMIT");
      return await this.getAppUserById(resolvedId) ?? null;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Legacy User (in-memory — used by older code paths) ──────────────────

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // ── Generations (in-memory) ─────────────────────────────────────────────

  async createGeneration(gen: Omit<InsertGeneration, "id" | "createdAt">): Promise<Generation> {
    const id = randomUUID();
    const generation: Generation = {
      id,
      userId: gen.userId ?? null,
      sessionId: gen.sessionId ?? null,
      originalImageUrl: gen.originalImageUrl,
      gptAnalysis: gen.gptAnalysis ?? null,
       seoText: (gen as any).seoText ?? null,
      kieTaskId: gen.kieTaskId ?? null,
      resultImageUrl: gen.resultImageUrl ?? null,
      backgroundTaskId: gen.backgroundTaskId ?? null,
      backgroundImageUrl: gen.backgroundImageUrl ?? null,
      status: gen.status ?? "pending",
      errorMessage: gen.errorMessage ?? null,
      model: gen.model ?? "nano-banana-pro",
      aspectRatio: gen.aspectRatio ?? "1:1",
      notes: gen.notes ?? null,
      generationType: (gen as any).generationType ?? "card",
      usedTrial: gen.usedTrial ?? false,
      expiresAt: gen.expiresAt ?? null,
      createdAt: new Date(),
    };
    this.generations.set(id, generation);
    return generation;
  }

  async getGeneration(id: string): Promise<Generation | undefined> {
    return this.generations.get(id);
  }

  async updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined> {
    const existing = this.generations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.generations.set(id, updated);
    return updated;
  }

  async listGenerations(filter: { userId?: string; sessionId?: string }): Promise<Generation[]> {
    const now = new Date();
    let values = Array.from(this.generations.values()).filter((g) => {
      if (g.expiresAt && new Date(g.expiresAt) < now) return false;
      return true;
    });
    if (filter.userId) {
      values = values.filter((g) => g.userId === filter.userId);
    } else if (filter.sessionId) {
      values = values.filter((g) => g.sessionId === filter.sessionId);
    }
    return values.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  }

  async transferSessionGenerations(sessionId: string, userId: string): Promise<number> {
    let count = 0;
    for (const [id, gen] of this.generations.entries()) {
      if (gen.sessionId === sessionId) {
        gen.userId = userId;
        gen.sessionId = null;
        this.generations.set(id, gen);
        count++;
      }
    }
    return count;
  }

  async deleteExpiredGenerations(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [id, gen] of this.generations.entries()) {
      if (gen.expiresAt && new Date(gen.expiresAt) < now) {
        this.generations.delete(id);
        count++;
      }
    }
    return count;
  }

  // ── Server users tracking (in-memory) ───────────────────────────────────

  async trackUser(username: string): Promise<ServerUser> {
    const existing = this.serverUsers.get(username);
    if (existing) return existing;
    const user: ServerUser = {
      username, id: null, registeredAt: new Date(),
      generationCount: 0, pendingNano2: 0, pendingPro: 0,
      nano2Balance: 0, proBalance: 0, starsBalance: 0, isDeveloper: false,
    };
    this.serverUsers.set(username, user);
    return user;
  }

  async getServerUser(username: string): Promise<ServerUser | undefined> {
    return this.serverUsers.get(username);
  }

  async getAllServerUsers(): Promise<ServerUser[]> {
    // Merge in-memory tracking with real balances from PostgreSQL
    const appUsersRes = await pool.query("SELECT * FROM app_users ORDER BY created_at DESC");
    const appUsers = appUsersRes.rows.map(rowToAppUser);
    const appUsersByEmail = new Map(appUsers.map((u) => [u.username.toLowerCase(), u]));

    // Build a combined list: start from registered app users
    const result: ServerUser[] = appUsers.map((au) => {
      const su = this.serverUsers.get(au.username.toLowerCase()) ??
                 this.serverUsers.get(au.username);
      return {
        username: au.username,
        id: au.id,
        registeredAt: au.createdAt,
        generationCount: su?.generationCount ?? 0,
        pendingNano2: su?.pendingNano2 ?? 0,
        pendingPro: su?.pendingPro ?? 0,
        nano2Balance: au.nano2Balance,
        proBalance: au.proBalance,
        starsBalance: au.starsBalance,
        isDeveloper: au.isDeveloper,
      };
    });

    // Add any legacy server users not yet registered
    for (const [, su] of this.serverUsers.entries()) {
      if (!appUsersByEmail.has(su.username.toLowerCase())) {
        result.push(su);
      }
    }

    return result;
  }

  async incrementUserGenerations(username: string): Promise<void> {
    if (!username) return;
    const user = this.serverUsers.get(username);
    if (user) {
      user.generationCount++;
    } else {
      this.serverUsers.set(username, {
        username, id: null, registeredAt: new Date(),
        generationCount: 1, pendingNano2: 0, pendingPro: 0,
        nano2Balance: 0, proBalance: 0, starsBalance: 0, isDeveloper: false,
      });
    }
  }

  async addPendingCredits(username: string, nano2: number, pro: number): Promise<void> {
    let user = this.serverUsers.get(username);
    if (!user) {
      user = { username, id: null, registeredAt: new Date(), generationCount: 0, pendingNano2: 0, pendingPro: 0, nano2Balance: 0, proBalance: 0, starsBalance: 0, isDeveloper: false };
      this.serverUsers.set(username, user);
    }
    user.pendingNano2 += nano2;
    user.pendingPro += pro;
  }

  async consumePendingCredits(username: string): Promise<{ nano2: number; pro: number }> {
    const user = this.serverUsers.get(username);
    if (!user || (user.pendingNano2 === 0 && user.pendingPro === 0)) return { nano2: 0, pro: 0 };
    const result = { nano2: user.pendingNano2, pro: user.pendingPro };
    user.pendingNano2 = 0;
    user.pendingPro = 0;
    return result;
  }

  // ── Error logs (in-memory) ───────────────────────────────────────────────

  async addErrorLog(log: Omit<ErrorLog, "id" | "createdAt">): Promise<ErrorLog> {
    const entry: ErrorLog = { id: randomUUID(), ...log, createdAt: new Date() };
    this.errorLogs.unshift(entry);
    if (this.errorLogs.length > 500) this.errorLogs.pop();
    return entry;
  }

  async getErrorLogs(): Promise<ErrorLog[]> {
    return [...this.errorLogs];
  }

  // ── Support (PostgreSQL) ────────────────────────────────────────────────

  async getOrCreateSupportChat(telegramUserId: string, userId?: string, userName?: string): Promise<SupportChat> {
    const res = await pool.query(
      `INSERT INTO support_chats (telegram_user_id, user_id, user_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         user_id = COALESCE(EXCLUDED.user_id, support_chats.user_id),
         user_name = CASE
           WHEN EXCLUDED.user_name <> '' THEN EXCLUDED.user_name
           ELSE support_chats.user_name
         END
       RETURNING *`,
      [telegramUserId, userId || null, userName?.trim() || telegramUserId],
    );
    return rowToSupportChat(res.rows[0]);
  }

  async getSupportChat(id: string): Promise<SupportChat | undefined> {
    const res = await pool.query("SELECT * FROM support_chats WHERE id=$1", [id]);
    return res.rows[0] ? rowToSupportChat(res.rows[0]) : undefined;
  }

  async getSupportChatByTelegramId(telegramUserId: string): Promise<SupportChat | undefined> {
    const res = await pool.query("SELECT * FROM support_chats WHERE telegram_user_id=$1", [telegramUserId]);
    return res.rows[0] ? rowToSupportChat(res.rows[0]) : undefined;
  }

  async listSupportChats(): Promise<SupportChat[]> {
    const res = await pool.query("SELECT * FROM support_chats ORDER BY last_activity DESC");
    return res.rows.map(rowToSupportChat);
  }

  async updateSupportChatStatus(id: string, status: "open" | "closed"): Promise<SupportChat | undefined> {
    const res = await pool.query(
      "UPDATE support_chats SET status=$1 WHERE id=$2 RETURNING *",
      [status, id],
    );
    return res.rows[0] ? rowToSupportChat(res.rows[0]) : undefined;
  }

  async addSupportMessage(msg: Omit<SupportMessage, "id" | "createdAt" | "telegramUpdateId"> & { telegramUpdateId?: string | null }): Promise<SupportMessage> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO support_messages
           (chat_id, telegram_user_id, message, telegram_update_id, is_from_user, is_read)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [
          msg.chatId,
          msg.telegramUserId ?? null,
          msg.message,
          msg.telegramUpdateId ?? null,
          msg.isFromUser,
          msg.isRead,
        ],
      );

      if (inserted.rows[0]) {
        await client.query(
          `UPDATE support_chats
           SET last_message=$1, last_activity=NOW()
           WHERE id=$2`,
          [msg.message, msg.chatId],
        );
        await client.query("COMMIT");
        return rowToSupportMessage(inserted.rows[0]);
      }

      const existing = msg.telegramUpdateId
        ? await client.query(
            "SELECT * FROM support_messages WHERE telegram_update_id=$1",
            [msg.telegramUpdateId],
          )
        : { rows: [] };
      await client.query("COMMIT");
      if (existing.rows[0]) return rowToSupportMessage(existing.rows[0]);
      throw new Error("Не удалось сохранить сообщение поддержки");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async getSupportMessages(chatId: string): Promise<SupportMessage[]> {
    const res = await pool.query(
      "SELECT * FROM support_messages WHERE chat_id=$1 ORDER BY created_at ASC",
      [chatId],
    );
    return res.rows.map(rowToSupportMessage);
  }

  async markMessagesRead(chatId: string): Promise<void> {
    await pool.query(
      "UPDATE support_messages SET is_read=TRUE WHERE chat_id=$1 AND is_from_user=TRUE",
      [chatId],
    );
  }

  async countUnreadMessages(chatId: string): Promise<number> {
    const res = await pool.query(
      "SELECT COUNT(*)::int AS count FROM support_messages WHERE chat_id=$1 AND is_from_user=TRUE AND is_read=FALSE",
      [chatId],
    );
    return Number(res.rows[0]?.count ?? 0);
  }
}

export const storage = new MemStorage();
