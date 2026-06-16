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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private generations: Map<string, Generation>;
  private payments: Map<string, PaymentRecord>;

  constructor() {
    this.users = new Map();
    this.generations = new Map();
    this.payments = new Map();
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
}

export const storage = new MemStorage();
