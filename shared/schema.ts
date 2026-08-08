import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default("gen_random_uuid()"),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const generations = pgTable("generations", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"),
  originalImageUrl: text("original_image_url").notNull(),
  gptAnalysis: jsonb("gpt_analysis"),
  seoText: jsonb("seo_text"),
  kieTaskId: text("kie_task_id"),
  resultImageUrl: text("result_image_url"),
  processingNotice: text("processing_notice"),
  backgroundTaskId: text("background_task_id"),
  backgroundImageUrl: text("background_image_url"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  model: text("model").default("nano-banana-pro"),
  aspectRatio: text("aspect_ratio").default("1:1"),
  notes: text("notes"),
  generationType: text("generation_type").default("card"),
  usedTrial: boolean("used_trial").default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGenerationSchema = createInsertSchema(generations).omit({
  createdAt: true,
});

export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const supportChats = pgTable("support_chats", {
  id: varchar("id").primaryKey().default("gen_random_uuid()"),
  userId: varchar("user_id"),
  telegramUserId: varchar("telegram_user_id").notNull(),
  userName: text("user_name").notNull().default(""),
  lastMessage: text("last_message"),
  lastActivity: timestamp("last_activity").defaultNow(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default("gen_random_uuid()"),
  chatId: varchar("chat_id").notNull(),
  telegramUserId: varchar("telegram_user_id"),
  message: text("message").notNull(),
  telegramUpdateId: text("telegram_update_id"),
  isFromUser: boolean("is_from_user").notNull().default(true),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportChatSchema = createInsertSchema(supportChats).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});

export type SupportChat = typeof supportChats.$inferSelect;
export type InsertSupportChat = z.infer<typeof insertSupportChatSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

export type GptAnalysis = {
  title: string;
  description: string;
  benefits: string[];
  characteristics?: string[];
  useCases?: string[];
  keywords?: string[];
  callToAction: string;
  designStyle: string;
  prompt: string;
};

export type SeoText = {
  marketplaceTitle: string;
  description: string;
  keywords: string[];
  benefits: string[];
  source: "ai-analysis" | "template";
};

export const MODELS = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Быстрая генерация, 1K качество",
    stars: 3,
    resolution: "1K",
    badge: "Эконом",
    pricePerCard: 40,
    pros: "Дёшево, быстро",
    cons: "Низкое качество, плохо с русским текстом",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Максимальное качество, 2K",
    stars: 7,
    resolution: "2K",
    badge: "Премиум",
    pricePerCard: 60,
    pros: "Максимальное качество, 2K",
    cons: "Дорого, может плохо с русским текстом",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const BACKGROUND_MODELS = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Быстрая генерация, экономичный расход",
    stars: 1,
    badge: "Эконом",
  },
  {
    id: "grok-imagine-image",
    name: "Grok Imagine",
    description: "Реалистичные фоны, хорошая работа с текстом",
    stars: 2,
    badge: "Стандарт",
  },
  {
    id: "gpt-image-1.5",
    name: "GPT Image 1.5",
    description: "Максимальная детализация, точное следование промпту",
    stars: 3,
    badge: "Премиум",
  },
] as const;

export type BackgroundModelId = (typeof BACKGROUND_MODELS)[number]["id"];

export const ASPECT_RATIOS = [
  {
    id: "1:1",
    label: "1:1",
    description: "Квадрат",
    marketplaces: ["Универсальный формат"],
  },
  {
    id: "3:4",
    label: "3:4",
    description: "Портрет",
    marketplaces: ["Универсальный портретный формат"],
  },
  {
    id: "4:5",
    label: "4:5",
    description: "Вертикальная карточка",
    marketplaces: ["Вертикальный формат"],
  },
  {
    id: "4:3",
    label: "4:3",
    description: "Пейзаж",
    marketplaces: ["Широкий формат"],
  },
  {
    id: "9:16",
    label: "9:16",
    description: "Вертикаль",
    marketplaces: ["Социальный вертикальный формат"],
  },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export const TRIAL_LIMIT = 2;

export const INITIAL_STARS = 10;
export const VIDEO_STAR_COSTS: Record<5 | 10, number> = { 5: 5, 10: 10 };
export const TRYON_STAR_COST = 5;

export const TEST_MODE = false;
export const TEST_PRICE_FACTOR = 0.01;

export function getPrice(realPrice: number): number {
  return TEST_MODE ? Math.max(1, Math.round(realPrice * TEST_PRICE_FACTOR)) : realPrice;
}

export function starsToGenerations(stars: number) {
  return {
    pro: Math.floor(stars / 7),
    nano2: Math.floor(stars / 3),
  };
}

export const NANO2_PACKAGES = [
  { id: "nano2-5", cards: 5, starsIncluded: 5, price: 349, perCard: 69.8, saving: 0, popular: false },
  { id: "nano2-10", cards: 10, starsIncluded: 10, price: 499, perCard: 45.4, saving: 5, popular: true },
  { id: "nano2-50", cards: 50, starsIncluded: 50, price: 1790, perCard: 35.8, saving: 10, popular: false },
  { id: "nano2-100", cards: 100, starsIncluded: 100, price: 3490, perCard: 34.9, saving: 13, popular: false },
] as const;

export const PRO_PACKAGES = [
  { id: "pro-5", cards: 5, starsIncluded: 5, price: 399, perCard: 79.8, saving: 0, popular: false },
  { id: "pro-10", cards: 10, starsIncluded: 10, price: 599, perCard: 54.5, saving: 3, popular: true },
  { id: "pro-50", cards: 50, starsIncluded: 50, price: 2790, perCard: 55.8, saving: 7, popular: false },
  { id: "pro-100", cards: 100, starsIncluded: 100, price: 5490, perCard: 54.9, saving: 8, popular: false },
] as const;

export const STAR_PACKAGES = [
  { id: "stars_10", stars: 10, price: 100, description: "10 звёзд для инструментов редактора" },
  { id: "stars_50", stars: 50, price: 400, description: "50 звёзд для инструментов редактора" },
  { id: "stars_100", stars: 100, price: 700, description: "100 звёзд для инструментов редактора" },
  { id: "stars_250", stars: 250, price: 1500, description: "250 звёзд для инструментов редактора" },
] as const;

export const MARKETPLACE_FORMATS = [
  { id: "portrait-standard", name: "Стандартный портрет", ratio: "3:4", width: 900, height: 1200, maxMb: 10, hint: "" },
  {
    id: "portrait-large",
    name: "Портретный расширенный",
    ratio: "3:4",
    width: 878,
    height: 1170,
    maxMb: 10,
    hint: "Также поддерживается квадратный формат.",
  },
  { id: "square-standard", name: "Стандартный квадрат", ratio: "1:1", width: 500, height: 500, maxMb: 25, hint: "Рекомендуемый размер от 500×500 px." },
] as const;

export type MarketplaceFormatId = (typeof MARKETPLACE_FORMATS)[number]["id"];

export const PRICING_PLANS = [
  {
    id: "single",
    name: "Поштучно",
    subtitle: "Для новичков",
    price: 400,
    cards: 1,
    starsIncluded: 7,
    unit: "за карточку",
    features: ["1 карточка товара", "GPT-4o анализ", "2K качество", "Скачивание PNG"],
    popular: false,
  },
  {
    id: "start",
    name: "Старт",
    subtitle: "10 карточек",
    price: 2500,
    cards: 10,
    starsIncluded: 70,
    unit: "250 ₽/шт",
    features: ["10 карточек товара", "GPT-4o анализ", "2K качество", "Скачивание PNG", "Экономия 37%"],
    popular: true,
  },
  {
    id: "opt",
    name: "Опт",
    subtitle: "30 карточек",
    price: 6000,
    cards: 30,
    starsIncluded: 210,
    unit: "200 ₽/шт",
    features: ["30 карточек товара", "GPT-4o анализ", "2K качество", "Скачивание PNG", "Экономия 50%"],
    popular: false,
  },
  {
    id: "brand",
    name: "Бренд",
    subtitle: "50 карточек",
    price: 9000,
    cards: 50,
    starsIncluded: 360,
    unit: "180 ₽/шт",
    features: ["50 карточек товара", "GPT-4o анализ", "2K качество", "Скачивание PNG", "Дизайн под ключ", "Экономия 55%"],
    popular: false,
  },
] as const;

export const SUBSCRIPTION_PLANS = [
  {
    id: "mini",
    name: "Мини",
    price: 1500,
    unit: "мес",
    cards: 30,
    starsIncluded: 210,
    perCard: 50,
    features: ["30 карточек/мес", "GPT-4o анализ", "2K качество", "50 ₽/шт"],
    popular: false,
  },
  {
    id: "standard",
    name: "Стандарт",
    price: 4000,
    unit: "мес",
    cards: 100,
    starsIncluded: 700,
    perCard: 40,
    features: ["100 карточек/мес", "GPT-4o анализ", "2K качество", "40 ₽/шт", "Приоритет"],
    popular: true,
  },
  {
    id: "unlimited",
    name: "Безлимит",
    price: 9000,
    unit: "мес",
    cards: 300,
    starsIncluded: 2100,
    perCard: 30,
    features: ["до 300 карточек/мес", "GPT-4o анализ", "2K качество", "от 30 ₽/шт", "Приоритет генерации", "Персональная поддержка"],
    popular: false,
  },
] as const;
