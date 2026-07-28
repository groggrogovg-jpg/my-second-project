import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { randomUUID, createHash } from "crypto";

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
  // Подписки на пакеты карточек по моделям. Срок действия — 30 дней с момента покупки.
  // При покупке нового пакета старые карточки для этой модели сгорают.
  nano2Subscription: ModelSubscription;
  proSubscription: ModelSubscription;
  // Независимые флаги бесплатной пробной попытки для каждой функции
  trialNano2Used: boolean;
  trialNano2Count: number;
  trialProUsed: boolean;
  trialTryonUsed: boolean;
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
  // Аккаунт, которому принадлежит платёж (устанавливается при создании, если пользователь авторизован).
  // Начисление баланса разрешено только владельцу и только один раз (см. `credited`).
  userId: string | null;
  credited: boolean;
  createdAt: Date;
}

export interface ServerUser {
  username: string;
  // ID аккаунта (AppUser), если он уже зарегистрирован; null для legacy-записей без аккаунта.
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
  resetUserPassword(username: string, passwordHash: string): Promise<boolean>;
  markTrialUsed(id: string, feature: TrialFeature): Promise<void>;
  // Атомарно проверяет и списывает право на генерацию (баланс или пробная попытка).
  // Возвращает null, если ни баланса, ни пробной попытки нет (запрос должен быть отклонён).
  consumeEntitlement(id: string, feature: TrialFeature): Promise<{ usedTrial: boolean } | null>;
  // Откатывает списание, сделанное consumeEntitlement, если генерация не удалась.
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
  recordPayment(payment: Omit<PaymentRecord, "confirmed" | "credited" | "createdAt">): Promise<PaymentRecord>;
  updatePaymentOperationId(label: string, operationId: string): Promise<PaymentRecord | undefined>;
  getPaymentByLabel(label: string): Promise<PaymentRecord | undefined>;
  confirmPayment(label: string): Promise<PaymentRecord | undefined>;
  listPayments(): Promise<PaymentRecord[]>;
  // Атомарно начисляет баланс из подтверждённого платежа владельцу-аккаунту и помечает его начисленным.
  // Возвращает null, если платёж не найден/не подтверждён/уже начислен/принадлежит другому пользователю.
  creditConfirmedPayment(label: string, userId: string): Promise<AppUser | null>;
  // Начисляет баланс разработчика по проверенному промокоду (проверка кода — на сервере).
  grantDeveloperCredit(userId: string, nano2: number, pro: number): Promise<AppUser | undefined>;
  // Немедленно начисляет баланс существующему аккаунту (admin-панель). Возвращает undefined, если аккаунт не найден.
  creditAppUserBalanceByUsername(username: string, model: "nano2" | "pro", amount: number): Promise<AppUser | undefined>;
  // Server-side user tracking
  trackUser(username: string): Promise<ServerUser>;
  getServerUser(username: string): Promise<ServerUser | undefined>;
  getAllServerUsers(): Promise<ServerUser[]>;
  incrementUserGenerations(username: string): Promise<void>;
  addPendingCredits(username: string, nano2: number, pro: number): Promise<void>;
  consumePendingCredits(username: string): Promise<{ nano2: number; pro: number }>;
  // Error logs
  addErrorLog(log: Omit<ErrorLog, "id" | "createdAt">): Promise<ErrorLog>;
  getErrorLogs(): Promise<ErrorLog[]>;
  // Support
  getOrCreateSupportChat(telegramUserId: string, userId?: string): Promise<SupportChat>;
  getSupportChat(id: string): Promise<SupportChat | undefined>;
  getSupportChatByTelegramId(telegramUserId: string): Promise<SupportChat | undefined>;
  listSupportChats(): Promise<SupportChat[]>;
  updateSupportChatStatus(id: string, status: "open" | "closed"): Promise<SupportChat | undefined>;
  addSupportMessage(msg: Omit<SupportMessage, "id" | "createdAt">): Promise<SupportMessage>;
  getSupportMessages(chatId: string): Promise<SupportMessage[]>;
  markMessagesRead(chatId: string): Promise<void>;
  countUnreadMessages(chatId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private appUsers: Map<string, AppUser>;
  private generations: Map<string, Generation>;
  private payments: Map<string, PaymentRecord>;
  private serverUsers: Map<string, ServerUser>;
  private errorLogs: ErrorLog[];
  private supportChats: Map<string, SupportChat>;
  private supportMessages: Map<string, SupportMessage>;
  // Admin reset tokens (not in IStorage interface — admin-only)
  private adminResetTokens: Map<string, Date>;
  adminOverrideCode: string | null;
  // Токены восстановления пароля обычных пользователей (не в IStorage — деталь реализации)
  // Ключ — SHA-256 хеш токена, значение — { email, expiresAt, used }.
  // Сам токен никогда не хранится в памяти, только его хеш.
  private passwordResetTokens: Map<string, { email: string; expiresAt: Date; used: boolean }>;
  // Rate limiting: email → время последнего запроса на восстановление пароля
  private passwordResetRateLimit: Map<string, Date>;

  constructor() {
    this.users = new Map();
    this.appUsers = new Map();
    this.generations = new Map();
    this.payments = new Map();
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час
    this.passwordResetTokens.set(tokenHash, { email: email.toLowerCase(), expiresAt, used: false });
    return rawToken;
  }

  // Проверяет, можно ли отправить повторное письмо: не чаще 1 раза в 5 минут на email.
  canRequestPasswordReset(email: string): boolean {
    const normalized = email.toLowerCase();
    const last = this.passwordResetRateLimit.get(normalized);
    if (!last) return true;
    return Date.now() - last.getTime() >= 5 * 60 * 1000;
  }

  markPasswordResetRequested(email: string): void {
    this.passwordResetRateLimit.set(email.toLowerCase(), new Date());
  }

  // Возвращает email, если токен валиден, не истёк и не использован, иначе null.
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

  createAdminResetToken(): string {
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

  async createAppUser(email: string, passwordHash: string): Promise<AppUser> {
    const id = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    const user: AppUser = {
      id,
      username: normalizedEmail,
      email: normalizedEmail,
      password: passwordHash,
      passwordHash,
      nano2Balance: 0,
      proBalance: 0,
      starsBalance: 0,
      nano2Subscription: { cards: 0, expiresAt: now },
      proSubscription: { cards: 0, expiresAt: now },
      trialNano2Used: false,
      trialNano2Count: 0,
      trialProUsed: false,
      trialTryonUsed: false,
      isDeveloper: false,
      createdAt: now,
    };
    this.appUsers.set(id, user);
    return user;
  }

  async getAppUserById(id: string): Promise<AppUser | undefined> {
    const user = this.appUsers.get(id);
    if (user) {
      user.trialNano2Count = Number.isFinite(user.trialNano2Count) ? user.trialNano2Count : (user.trialNano2Used ? 1 : 0);
      syncModelBalances(user);
    }
    return user;
  }

  async getAppUserByUsername(username: string): Promise<AppUser | undefined> {
    const user = Array.from(this.appUsers.values()).find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      user.trialNano2Count = Number.isFinite(user.trialNano2Count) ? user.trialNano2Count : (user.trialNano2Used ? 1 : 0);
      syncModelBalances(user);
    }
    return user;
  }

  async updateAppUserBalances(id: string, nano2: number, pro: number): Promise<void> {
    const user = this.appUsers.get(id);
    if (user) {
      const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
      user.nano2Subscription = { cards: Math.max(0, nano2), expiresAt };
      user.proSubscription = { cards: Math.max(0, pro), expiresAt };
      syncModelBalances(user);
    }
  }

  async updateStarsBalance(id: string, delta: number): Promise<void> {
    const user = this.appUsers.get(id);
    if (user) {
      user.starsBalance = Math.max(0, user.starsBalance + delta);
    }
  }

  async consumeEntitlement(id: string, feature: TrialFeature): Promise<{ usedTrial: boolean } | null> {
    const user = this.appUsers.get(id);
    if (!user) return null;
    syncModelBalances(user);
    if (feature === "nano2") {
      if (effectiveCards(user.nano2Subscription) > 0) {
        user.nano2Subscription.cards -= 1;
        syncModelBalances(user);
        return { usedTrial: false };
      }
      if (!user.trialNano2Used) {
        user.trialNano2Used = true;
        user.trialNano2Count = Math.max(1, user.trialNano2Count || 0);
        return { usedTrial: true };
      }
      if (user.trialNano2Count < 2) {
        user.trialNano2Count += 1;
        return { usedTrial: true };
      }
      return null;
    }
    if (feature === "pro") {
      if (effectiveCards(user.proSubscription) > 0) {
        user.proSubscription.cards -= 1;
        syncModelBalances(user);
        return { usedTrial: false };
      }
      return null;
    }
    // tryon
    if (effectiveCards(user.nano2Subscription) > 0) {
      user.nano2Subscription.cards -= 1;
      syncModelBalances(user);
      return { usedTrial: false };
    }
    if (!user.trialTryonUsed) {
      user.trialTryonUsed = true;
      return { usedTrial: true };
    }
    return null;
  }

  async refundEntitlement(id: string, feature: TrialFeature, usedTrial: boolean): Promise<void> {
    const user = this.appUsers.get(id);
    if (!user) return;
    if (usedTrial) {
      if (feature === "nano2") {
        user.trialNano2Count = Math.max(0, user.trialNano2Count - 1);
        user.trialNano2Used = user.trialNano2Count > 0;
      }
      else if (feature === "pro") user.trialProUsed = false;
      else user.trialTryonUsed = false;
      return;
    }
    if (feature === "nano2") user.nano2Subscription.cards += 1;
    else if (feature === "pro") user.proSubscription.cards += 1;
    else user.nano2Subscription.cards += 1;
    syncModelBalances(user);
  }

  async grantDeveloperCredit(userId: string, nano2: number, pro: number): Promise<AppUser | undefined> {
    const user = this.appUsers.get(userId);
    if (!user) return undefined;
    const expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
    user.nano2Subscription.cards += nano2;
    user.nano2Subscription.expiresAt = expiresAt;
    user.proSubscription.cards += pro;
    user.proSubscription.expiresAt = expiresAt;
    user.isDeveloper = true;
    syncModelBalances(user);
    return user;
  }

  async creditAppUserBalanceByUsername(username: string, model: "nano2" | "pro", amount: number): Promise<AppUser | undefined> {
    const user = Array.from(this.appUsers.values()).find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (!user) return undefined;
    const sub = model === "pro" ? user.proSubscription : user.nano2Subscription;
    sub.cards += amount;
    sub.expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
    syncModelBalances(user);
    return user;
  }

  async resetUserPassword(username: string, passwordHash: string): Promise<boolean> {
    const user = Array.from(this.appUsers.values()).find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (!user) return false;
    user.passwordHash = passwordHash;
    user.password = passwordHash;
    this.appUsers.set(user.id, user);
    return true;
  }

  async markTrialUsed(id: string, feature: TrialFeature): Promise<void> {
    const user = this.appUsers.get(id);
    if (!user) return;
    if (feature === "nano2") user.trialNano2Used = true;
    else if (feature === "pro") user.trialProUsed = true;
    else if (feature === "tryon") user.trialTryonUsed = true;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createGeneration(gen: Omit<InsertGeneration, "id" | "createdAt">): Promise<Generation> {
    const id = randomUUID();
    const generation: Generation = {
      id,
      userId: gen.userId ?? null,
      sessionId: gen.sessionId ?? null,
      originalImageUrl: gen.originalImageUrl,
      gptAnalysis: gen.gptAnalysis ?? null,
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
      // Исключаем просроченные
      if (g.expiresAt && new Date(g.expiresAt) < now) return false;
      return true;
    });
    if (filter.userId) {
      values = values.filter((g) => g.userId === filter.userId);
    } else if (filter.sessionId) {
      values = values.filter((g) => g.sessionId === filter.sessionId);
    }
    return values.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
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

  async recordPayment(payment: Omit<PaymentRecord, "confirmed" | "credited" | "createdAt">): Promise<PaymentRecord> {
    const record: PaymentRecord = {
      ...payment,
      confirmed: false,
      credited: false,
      createdAt: new Date(),
    };
    this.payments.set(payment.label, record);
    return record;
  }

  async creditConfirmedPayment(label: string, userId: string): Promise<AppUser | null> {
    const record = this.payments.get(label);
    if (!record || !record.confirmed || record.credited) return null;
    if (record.userId && record.userId !== userId) return null;
    const user = this.appUsers.get(userId);
    if (!user) return null;
    syncModelBalances(user);
    if (record.cardsIncluded > 0 && record.modelType) {
      const sub = record.modelType === "pro" ? user.proSubscription : user.nano2Subscription;
      // Новый пакет заменяет старые карточки для этой модели; срок — 30 дней с момента покупки.
      sub.cards = record.cardsIncluded;
      sub.expiresAt = new Date(Date.now() + PACKAGE_DURATION_MS);
      user.starsBalance += record.cardsIncluded;
      syncModelBalances(user);
    }
    if (record.starsToAdd > 0) {
      user.starsBalance += record.starsToAdd;
    }
    record.credited = true;
    if (!record.userId) record.userId = userId;
    this.payments.set(label, record);
    return user;
  }

  async updatePaymentOperationId(label: string, operationId: string): Promise<PaymentRecord | undefined> {
    const record = this.payments.get(label);
    if (!record) return undefined;
    record.operationId = operationId;
    this.payments.set(label, record);
    return record;
  }

  async getPaymentByLabel(label: string): Promise<PaymentRecord | undefined> {
    return this.payments.get(label);
  }

  async confirmPayment(label: string): Promise<PaymentRecord | undefined> {
    const record = this.payments.get(label);
    if (!record) return undefined;
    record.confirmed = true;
    this.payments.set(label, record);
    return record;
  }

  async listPayments(): Promise<PaymentRecord[]> {
    return Array.from(this.payments.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async trackUser(username: string): Promise<ServerUser> {
    const existing = this.serverUsers.get(username);
    if (existing) return existing;
    const user: ServerUser = {
      username,
      id: null,
      registeredAt: new Date(),
      generationCount: 0,
      pendingNano2: 0,
      pendingPro: 0,
      nano2Balance: 0,
      proBalance: 0,
      starsBalance: 0,
      isDeveloper: false,
    };
    this.serverUsers.set(username, user);
    return user;
  }

  async getServerUser(username: string): Promise<ServerUser | undefined> {
    return this.serverUsers.get(username);
  }

  async getAllServerUsers(): Promise<ServerUser[]> {
    const list = Array.from(this.serverUsers.values()).sort(
      (a, b) => b.registeredAt.getTime() - a.registeredAt.getTime()
    );
    return list.map((su) => {
      const appUser = Array.from(this.appUsers.values()).find(
        (u) => u.username.toLowerCase() === su.username.toLowerCase()
      );
      if (appUser) syncModelBalances(appUser);
      return {
        ...su,
        id: appUser?.id ?? null,
        nano2Balance: appUser?.nano2Balance ?? 0,
        proBalance: appUser?.proBalance ?? 0,
        starsBalance: appUser?.starsBalance ?? 0,
        isDeveloper: appUser?.isDeveloper ?? false,
      };
    });
  }

  async incrementUserGenerations(username: string): Promise<void> {
    if (!username) return;
    const user = this.serverUsers.get(username);
    if (user) {
      user.generationCount++;
    } else {
      this.serverUsers.set(username, {
        username,
        id: null,
        registeredAt: new Date(),
        generationCount: 1,
        pendingNano2: 0,
        pendingPro: 0,
        nano2Balance: 0,
        proBalance: 0,
        starsBalance: 0,
        isDeveloper: false,
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
    if (!user || (user.pendingNano2 === 0 && user.pendingPro === 0)) {
      return { nano2: 0, pro: 0 };
    }
    const result = { nano2: user.pendingNano2, pro: user.pendingPro };
    user.pendingNano2 = 0;
    user.pendingPro = 0;
    return result;
  }

  async addErrorLog(log: Omit<ErrorLog, "id" | "createdAt">): Promise<ErrorLog> {
    const entry: ErrorLog = {
      id: randomUUID(),
      ...log,
      createdAt: new Date(),
    };
    this.errorLogs.unshift(entry);
    if (this.errorLogs.length > 500) this.errorLogs.pop();
    return entry;
  }

  async getErrorLogs(): Promise<ErrorLog[]> {
    return [...this.errorLogs];
  }

  // === Support ===
  async getOrCreateSupportChat(telegramUserId: string, userId?: string): Promise<SupportChat> {
    const existing = Array.from(this.supportChats.values()).find(
      (c) => c.telegramUserId === telegramUserId
    );
    if (existing) return existing;
    const chat: SupportChat = {
      id: randomUUID(),
      userId: userId || null,
      telegramUserId,
      lastMessage: null,
      lastActivity: new Date(),
      status: "open",
      createdAt: new Date(),
    };
    this.supportChats.set(chat.id, chat);
    return chat;
  }

  async getSupportChat(id: string): Promise<SupportChat | undefined> {
    return this.supportChats.get(id);
  }

  async getSupportChatByTelegramId(telegramUserId: string): Promise<SupportChat | undefined> {
    return Array.from(this.supportChats.values()).find(
      (c) => c.telegramUserId === telegramUserId
    );
  }

  async listSupportChats(): Promise<SupportChat[]> {
    return Array.from(this.supportChats.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  async updateSupportChatStatus(id: string, status: "open" | "closed"): Promise<SupportChat | undefined> {
    const chat = this.supportChats.get(id);
    if (!chat) return undefined;
    chat.status = status;
    this.supportChats.set(id, chat);
    return chat;
  }

  async addSupportMessage(msg: Omit<SupportMessage, "id" | "createdAt">): Promise<SupportMessage> {
    const message: SupportMessage = {
      id: randomUUID(),
      ...msg,
      createdAt: new Date(),
    };
    this.supportMessages.set(message.id, message);
    // Update chat lastMessage and lastActivity
    const chat = this.supportChats.get(msg.chatId);
    if (chat) {
      chat.lastMessage = msg.message;
      chat.lastActivity = new Date();
      this.supportChats.set(chat.id, chat);
    }
    return message;
  }

  async getSupportMessages(chatId: string): Promise<SupportMessage[]> {
    return Array.from(this.supportMessages.values())
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async markMessagesRead(chatId: string): Promise<void> {
    for (const [id, msg] of this.supportMessages.entries()) {
      if (msg.chatId === chatId && msg.isFromUser) {
        msg.isRead = true;
        this.supportMessages.set(id, msg);
      }
    }
  }

  async countUnreadMessages(chatId: string): Promise<number> {
    return Array.from(this.supportMessages.values()).filter(
      (m) => m.chatId === chatId && m.isFromUser && !m.isRead
    ).length;
  }
}

export const storage = new MemStorage();
