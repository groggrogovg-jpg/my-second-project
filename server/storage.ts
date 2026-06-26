import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

// Полный аккаунт пользователя на сервере (расширяет User)
export interface AppUser extends User {
  passwordHash: string;
  nano2Balance: number;
  proBalance: number;
  trialCount: number;
  isDeveloper: boolean;
  createdAt: Date;
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
  createdAt: Date;
}

export interface ServerUser {
  username: string;
  registeredAt: Date;
  generationCount: number;
  pendingNano2: number;
  pendingPro: number;
  nano2Balance: number;
  proBalance: number;
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
  createAppUser(username: string, passwordHash: string): Promise<AppUser>;
  getAppUserById(id: string): Promise<AppUser | undefined>;
  getAppUserByUsername(username: string): Promise<AppUser | undefined>;
  updateAppUserBalances(id: string, nano2: number, pro: number): Promise<void>;
  resetUserPassword(username: string, passwordHash: string): Promise<boolean>;
  incrementAppUserTrial(id: string): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createGeneration(gen: Omit<InsertGeneration, "id">): Promise<Generation>;
  getGeneration(id: string): Promise<Generation | undefined>;
  updateGeneration(id: string, updates: Partial<Generation>): Promise<Generation | undefined>;
  listGenerations(): Promise<Generation[]>;
  recordPayment(payment: Omit<PaymentRecord, "confirmed" | "createdAt">): Promise<PaymentRecord>;
  updatePaymentOperationId(label: string, operationId: string): Promise<PaymentRecord | undefined>;
  getPaymentByLabel(label: string): Promise<PaymentRecord | undefined>;
  confirmPayment(label: string): Promise<PaymentRecord | undefined>;
  listPayments(): Promise<PaymentRecord[]>;
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

  async createAppUser(username: string, passwordHash: string): Promise<AppUser> {
    const id = randomUUID();
    const user: AppUser = { id, username, password: passwordHash, passwordHash, nano2Balance: 0, proBalance: 0, trialCount: 0, isDeveloper: false, createdAt: new Date() };
    this.appUsers.set(id, user);
    return user;
  }

  async getAppUserById(id: string): Promise<AppUser | undefined> {
    return this.appUsers.get(id);
  }

  async getAppUserByUsername(username: string): Promise<AppUser | undefined> {
    return Array.from(this.appUsers.values()).find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  async updateAppUserBalances(id: string, nano2: number, pro: number): Promise<void> {
    const user = this.appUsers.get(id);
    if (user) {
      user.nano2Balance = Math.max(0, nano2);
      user.proBalance = Math.max(0, pro);
    }
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

  async incrementAppUserTrial(id: string): Promise<void> {
    const user = this.appUsers.get(id);
    if (user) user.trialCount++;
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

  async createGeneration(gen: Omit<InsertGeneration, "id">): Promise<Generation> {
    const id = randomUUID();
    const generation: Generation = {
      id,
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

  async listGenerations(): Promise<Generation[]> {
    return Array.from(this.generations.values()).sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async recordPayment(payment: Omit<PaymentRecord, "confirmed" | "createdAt">): Promise<PaymentRecord> {
    const record: PaymentRecord = {
      cardsIncluded: 0,
      modelType: "",
      username: "",
      ...payment,
      confirmed: false,
      createdAt: new Date(),
    };
    this.payments.set(payment.label, record);
    return record;
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
      registeredAt: new Date(),
      generationCount: 0,
      pendingNano2: 0,
      pendingPro: 0,
      nano2Balance: 0,
      proBalance: 0,
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
      return {
        ...su,
        nano2Balance: appUser?.nano2Balance ?? 0,
        proBalance: appUser?.proBalance ?? 0,
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
        registeredAt: new Date(),
        generationCount: 1,
        pendingNano2: 0,
        pendingPro: 0,
        nano2Balance: 0,
        proBalance: 0,
      });
    }
  }

  async addPendingCredits(username: string, nano2: number, pro: number): Promise<void> {
    let user = this.serverUsers.get(username);
    if (!user) {
      user = { username, registeredAt: new Date(), generationCount: 0, pendingNano2: 0, pendingPro: 0, nano2Balance: 0, proBalance: 0 };
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
