import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default("gen_random_uuid()"),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const generations = pgTable("generations", {
  id: varchar("id").primaryKey(),
  originalImageUrl: text("original_image_url").notNull(),
  gptAnalysis: jsonb("gpt_analysis"),
  kieTaskId: text("kie_task_id"),
  resultImageUrl: text("result_image_url"),
  backgroundTaskId: text("background_task_id"),
  backgroundImageUrl: text("background_image_url"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  model: text("model").default("nano-banana-pro"),
  aspectRatio: text("aspect_ratio").default("1:1"),
  notes: text("notes"),
  generationType: text("generation_type").default("card"),
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

export type GptAnalysis = {
  title: string;
  description: string;
  benefits: string[];
  callToAction: string;
  designStyle: string;
  prompt: string;
};

export const MODELS = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Быстрая генерация, 1K качество",
    stars: 3,
    resolution: "1K",
    badge: "Эконом",
    pros: "Дешёво, быстро",
    cons: "Низкое качество, плохо с русским текстом",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "Максимальное качество, 2K",
    stars: 7,
    resolution: "2K",
    badge: "Премиум",
    pros: "Максимальное качество, 2K",
    cons: "Дорого, может плохо с русским текстом",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const ASPECT_RATIOS = [
  {
    id: "1:1",
    label: "1:1",
    description: "Квадрат",
    marketplaces: ["Wildberries", "Ozon", "AliExpress"],
  },
  {
    id: "3:4",
    label: "3:4",
    description: "Портрет",
    marketplaces: ["Wildberries", "Ozon"],
  },
  {
    id: "4:5",
    label: "4:5",
    description: "WB",
    marketplaces: ["Wildberries (оптимально)"],
  },
  {
    id: "4:3",
    label: "4:3",
    description: "Пейзаж",
    marketplaces: ["Яндекс Маркет", "Авито"],
  },
  {
    id: "9:16",
    label: "9:16",
    description: "Вертикаль",
    marketplaces: ["Stories", "TikTok Shop"],
  },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

export const INITIAL_STARS = 10;

export const VIDEO_STAR_COSTS: Record<5 | 10, number> = { 5: 5, 10: 10 };
export const TRYON_STAR_COST = 5;

// Стоимость изменения фона через ИИ (совпадает с ценами моделей)
export const BG_EDIT_STAR_COSTS: Record<ModelId, number> = {
  "nano-banana-2": 3,
  "nano-banana-pro": 7,
};

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
