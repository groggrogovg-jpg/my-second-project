import { type User, type InsertUser, type Generation, type InsertGeneration } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export interface ErrorLog {
  id: string;
  username: string;
  model: string;
  errorMessage: string;
  generationType: string;
  createdAt: Date;
}

export interface IStorage {
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private generations: Map<string, Generation>;
  private payments: Map<string, PaymentRecord>;
  private serverUsers: Map<string, ServerUser>;
  private errorLogs: ErrorLog[];

  constructor() {
    this.users = new Map();
    this.generations = new Map();
    this.payments = new Map();
    this.serverUsers = new Map();
    this.errorLogs = [];
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
    };
    this.serverUsers.set(username, user);
    return user;
  }

  async getServerUser(username: string): Promise<ServerUser | undefined> {
    return this.serverUsers.get(username);
  }

  async getAllServerUsers(): Promise<ServerUser[]> {
    return Array.from(this.serverUsers.values()).sort(
      (a, b) => b.registeredAt.getTime() - a.registeredAt.getTime()
    );
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
      });
    }
  }

  async addPendingCredits(username: string, nano2: number, pro: number): Promise<void> {
    let user = this.serverUsers.get(username);
    if (!user) {
      user = { username, registeredAt: new Date(), generationCount: 0, pendingNano2: 0, pendingPro: 0 };
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
}

export const storage = new MemStorage();
