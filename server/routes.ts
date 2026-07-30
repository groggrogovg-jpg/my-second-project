import express from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, MemStorage, effectiveCards, type TrialFeature } from "./storage";
import { applyTrialWatermark, bufferToDataUrl } from "./watermark";
import multer from "multer";

/**
 * Скачивает итоговое изображение с Polza.ai и, если это пробная генерация,
 * накладывает серверный водяной знак. Для trial-режима возвращается data-URL,
 * чтобы исходное изображение не было доступно по удалённому URL.
 */
async function processResultImage(remoteUrl: string, isTrial: boolean): Promise<string> {
  const response = await axios.get(remoteUrl, { responseType: "arraybuffer", timeout: 15000 });
  const buffer = Buffer.from(response.data);
  if (!isTrial) return remoteUrl;
  const watermarked = await applyTrialWatermark(buffer);
  return bufferToDataUrl(watermarked, "image/png");
}
import OpenAI from "openai";
import axios from "axios";
import path from "path";
import crypto from "crypto";
import { URL } from "url";
import bcrypt from "bcrypt";
import { sendPasswordResetEmail } from "./email";

const YM_NOTIFY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || "";
const YM_ACCESS_TOKEN = process.env.YOOMONEY_ACCESS_TOKEN || "";
const DEV_PROMO_CODE = process.env.DEV_PROMO_CODE || "DEV100";

function adminOnly(req: Request, res: Response, next: Function) {
  const devCode = (req.headers["x-dev-code"] as string) || "";
  if (!devCode) return res.status(403).json({ error: "Доступ запрещён" });
  const memStorage = storage as MemStorage;
  if (devCode.trim() === DEV_PROMO_CODE) return next();
  if (memStorage.adminOverrideCode && devCode.trim() === memStorage.adminOverrideCode) return next();
  return res.status(403).json({ error: "Доступ запрещён" });
}

// Идентификатор администратора для логов действий. У админ-панели нет отдельных
// учётных записей — доступ даётся общим dev-кодом, поэтому в качестве "актора"
// используем маскированный код (без раскрытия секрета в логах).
function adminActorLabel(req: Request): string {
  const devCode = (req.headers["x-dev-code"] as string) || "";
  if (!devCode) return "admin(unknown)";
  return `admin(code=${devCode.trim().substring(0, 2)}***)`;
}

const TEST_MODE = false;
function getTestPrice(realPrice: number): number {
  return TEST_MODE ? Math.max(1, Math.round(realPrice * 0.01)) : realPrice;
}

// SSRF защита: валидация URL для загрузки изображений
function isTrustedImageUrl(url: string): boolean {
  if (url.startsWith("data:")) return true;
  if (url.startsWith("blob:")) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const trustedHosts = [
      "polza.ai",
      "s3.polza.ai",
      "storage.googleapis.com",
      "googleusercontent.com",
    ];
    if (trustedHosts.some(h => hostname === h || hostname.endsWith(`.${h}`))) return true;
    // Запрет приватных ип и локальных сетей
    const privateHosts = [
      "localhost", "127.0.0.1", "0.0.0.0", "::1",
      "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.",
    ];
    if (privateHosts.some(h => hostname.startsWith(h) || hostname === h)) return false;
    // Разрешаем только http(s) и только доверенные хосты
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return false;
  } catch {
    return false;
  }
}

const PLAN_DATA: Record<string, { price: number; starsIncluded: number; name: string }> = {
  single:    { price: 400,  starsIncluded: 7,    name: "Поштучно" },
  start:     { price: 2500, starsIncluded: 70,   name: "Старт" },
  opt:       { price: 6000, starsIncluded: 210,  name: "Опт" },
  brand:     { price: 9000, starsIncluded: 360,  name: "Бренд" },
  mini:      { price: 1500, starsIncluded: 210,  name: "Мини" },
  standard:  { price: 4000, starsIncluded: 700,  name: "Стандарт" },
  unlimited: { price: 9000, starsIncluded: 2100, name: "Безлимит" },
};

const PACKAGE_DATA: Record<string, { price: number; cardsIncluded: number; modelType: "nano2" | "pro"; name: string }> = {
  "nano2-5":   { price: 349,  cardsIncluded: 5,   modelType: "nano2", name: "Nano Banana 2 — 5 карточек" },
  "nano2-10":  { price: 499,  cardsIncluded: 11,  modelType: "nano2", name: "Nano Banana 2 — 10 карточек (+1 в подарок)" },
  "nano2-50":  { price: 1790, cardsIncluded: 50,  modelType: "nano2", name: "Nano Banana 2 — 50 карточек" },
  "nano2-100": { price: 3490, cardsIncluded: 100, modelType: "nano2", name: "Nano Banana 2 — 100 карточек" },
  "pro-5":     { price: 399,  cardsIncluded: 5,   modelType: "pro",   name: "Nano Banana Pro — 5 карточек" },
  "pro-10":    { price: 599,  cardsIncluded: 11,  modelType: "pro",   name: "Nano Banana Pro — 10 карточек (+1 в подарок)" },
  "pro-50":    { price: 2790, cardsIncluded: 50,  modelType: "pro",   name: "Nano Banana Pro — 50 карточек" },
  "pro-100":   { price: 5490, cardsIncluded: 100, modelType: "pro",   name: "Nano Banana Pro — 100 карточек" },
};

// Payment records currently live in process memory. Keep the package and owner
// in the signed payment label so a webhook can reconstruct a pending payment
// after a process restart (the webhook signature is still the source of trust).
function parsePackagePaymentLabel(label: string): { packageId: string; userId: string } | null {
  const match = label.match(/^pkg-(nano2-5|nano2-10|nano2-50|nano2-100|pro-5|pro-10|pro-50|pro-100)-(.+)-\d+$/);
  if (!match || !PACKAGE_DATA[match[1]]) return null;
  return { packageId: match[1], userId: match[2] };
}

async function verifyYooMoneyPayment(label: string, expectedAmount: string): Promise<{ operationId: string; amount: string } | null> {
  if (!YM_ACCESS_TOKEN) {
    console.warn("[payment/check] YOOMONEY_ACCESS_TOKEN is not configured");
    return null;
  }
  try {
    const response = await axios.post(
      "https://yoomoney.ru/api/operation-history",
      new URLSearchParams({
        records: "100",
        type: "deposition payment",
        direction: "in",
        label,
      }).toString(),
      {
        headers: {
          Authorization: `Bearer ${YM_ACCESS_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        timeout: 10000,
      },
    );
    const rawOperations = response.data?.operations;
    const operations = Array.isArray(rawOperations)
      ? rawOperations
      : rawOperations && typeof rawOperations === "object"
        ? Object.values(rawOperations)
        : [];
    const expected = Number(expectedAmount);
    const match = operations.find((operation: any) => {
      const operationLabel = String(operation?.label ?? "");
      const status = String(operation?.status ?? "").toLowerCase();
      const type = String(operation?.type ?? "").toLowerCase();
      const direction = String(operation?.direction ?? "").toLowerCase();
      const amount = Number(operation?.amount);
      return operationLabel === label &&
        (status === "success" || status === "completed") &&
        (!direction || direction === "in") &&
        (!type || type === "deposition" || type === "incoming-transfer") &&
        Number.isFinite(amount) &&
        Number.isFinite(expected) &&
        // YooMoney's operation history contains the net amount credited to
        // the wallet, after its commission. The payment label is generated
        // server-side and is the primary binding to this order.
        amount > 0 &&
        amount <= expected + 0.01 &&
        amount >= expected * 0.9;
    });
    if (operations.length > 0) {
      console.log(`[payment/check] candidates=${JSON.stringify(operations.slice(0, 5).map((operation: any) => ({
        status: operation?.status,
        direction: operation?.direction,
        type: operation?.type,
        amount: operation?.amount,
        hasLabel: Boolean(operation?.label),
        labelMatches: operation?.label === label,
      })))}`
      );
    }
    console.log(`[payment/check] label=${label} operations=${operations.length} matched=${Boolean(match)}`);
    return match ? { operationId: String(match.operation_id || match.operationId || ""), amount: String(match.amount) } : null;
  } catch (error: any) {
    console.error(`[payment/check] YooMoney API error: ${error.response?.status || error.message}`);
    return null;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Только изображения разрешены"));
  },
});

// Polza.ai — OpenAI-совместимый прокси
let openai: OpenAI;
function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.POLZA_API_KEY) {
      throw new Error("POLZA_API_KEY environment variable is not set");
    }
    openai = new OpenAI({
      apiKey: process.env.POLZA_API_KEY,
      baseURL: "https://polza.ai/api/v1",
    });
  }
  return openai;
}
// Маппинг пользовательских названий моделей на реальные ID в Polza.ai
const POLZA_MODEL_MAP: Record<string, string> = {
  "nano-banana-2":   "google/gemini-3.1-flash-image-preview",
  "nano-banana-pro": "google/gemini-3-pro-image-preview",
};

// Маппинг модели на разрешение
function modelToResolution(model: string): "1K" | "2K" {
  if (model === "nano-banana-pro") return "2K";
  return "1K";
}

// Вспомогательная функция: ждём мс
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Извлекает URL изображения из ответа /api/v1/media
function extractMediaUrl(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string" && (data.startsWith("http") || data.startsWith("data:"))) return data;
  if (data.url) return data.url;
  if (data.image_url) return data.image_url;
  if (data.b64_json) return `data:image/jpeg;base64,${data.b64_json}`;
  if (data.results?.[0]?.url) return data.results[0].url;
  if (Array.isArray(data) && data[0]?.url) return data[0].url;
  return null;
}

// Основная функция вызова Polza.ai /api/v1/media
async function callPolzaMedia(opts: {
  polzaModelId: string;
  prompt: string;
  aspectRatio?: string;
  imageResolution?: "1K" | "2K" | "4K";
  images?: Array<{ buffer: Buffer; mimeType: string }>;
}): Promise<string> {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) throw new Error("POLZA_API_KEY не задан");

  const inputImages = (opts.images || []).map(img => ({
    type: "base64",
    data: img.buffer.toString("base64"),
    media_type: img.mimeType,
  }));

  const body: any = {
    model: opts.polzaModelId,
    input: {
      prompt: opts.prompt,
      ...(opts.aspectRatio   ? { aspect_ratio: opts.aspectRatio }         : {}),
      ...(opts.imageResolution ? { image_resolution: opts.imageResolution } : {}),
      ...(inputImages.length > 0 ? { images: inputImages }                : {}),
    },
  };

  console.log(`[polza.ai/media] ▶ model=${opts.polzaModelId} ratio=${opts.aspectRatio} res=${opts.imageResolution} images=${inputImages.length}`);

  const resp = await fetch("https://polza.ai/api/v1/media", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Polza.ai ${resp.status}: ${text.substring(0, 300)}`);
  }

  let result: any;
  try { result = JSON.parse(text); } catch { throw new Error(`Polza.ai invalid JSON: ${text.substring(0, 200)}`); }

  console.log(`[polza.ai/media] ← status=${result.status} id=${result.id}`);

  // Синхронный успех
  if (result.status === "completed" || result.status === "done" || result.status === "succeeded") {
    const url = extractMediaUrl(result.data);
    if (url) { console.log(`[polza.ai/media] ✓ sync done`); return url; }
  }

  // Асинхронный — поллим
  if (result.id && (result.status === "pending" || result.status === "processing" || result.status === "in_progress")) {
    return await pollPolzaMedia(result.id, apiKey);
  }

  // Прямой результат без status
  const directUrl = extractMediaUrl(result.data ?? result);
  if (directUrl) return directUrl;

  throw new Error(`Polza.ai неожиданный ответ: ${JSON.stringify(result).substring(0, 300)}`);
}

// Поллинг результата асинхронной задачи Polza.ai
async function pollPolzaMedia(jobId: string, apiKey: string): Promise<string> {
  console.log(`[polza.ai/media] ⏳ polling jobId=${jobId}...`);
  const maxAttempts = 40; // ~2 минуты
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    const resp = await fetch(`https://polza.ai/api/v1/media/${jobId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error(`Polza.ai poll ${resp.status}`);
    const r: any = await resp.json();
    console.log(`[polza.ai/media] poll #${i + 1} status=${r.status}`);
    if (r.status === "completed" || r.status === "done" || r.status === "succeeded") {
      const url = extractMediaUrl(r.data);
      if (url) { console.log(`[polza.ai/media] ✓ async done`); return url; }
    }
    if (r.status === "failed" || r.status === "error") {
      throw new Error(`Polza.ai job failed: ${r.error || r.message || "unknown"}`);
    }
  }
  throw new Error("Polza.ai timeout: генерация заняла слишком много времени");
}

async function analyzeWithGpt(imageBase64: string, mimeType: string, notes?: string, noText?: boolean): Promise<any> {
  const promptField = noText
    ? `"prompt": "Детальный промпт на английском для нейросети: оформить фото товара в чистую профессиональную карточку, описав стиль фона, цветовую схему, освещение, тени и нейтральные декоративные элементы. ВАЖНО: без текста, логотипов, водяных знаков и символики сторонних платформ — только товар и фон)"`
    : `"prompt": "Детальный промпт на английском для нейросети: оформить фото товара в чистую профессиональную карточку, описав стиль фона, цветовую схему, текстовые блоки и нейтральную инфографику. Не добавляй логотипы, водяные знаки или символику сторонних платформ. Текст в карточке должен быть на РУССКОМ языке)"`;

  const systemPrompt = `Ты — профессиональный копирайтер и визуальный аналитик. Твоя задача — по одной загруженной фотографии товара создать полноценную, продающую карточку товара.

Алгоритм:
1. Внимательно проанализируй изображение: определи товар, категорию, тип, пол и возрастную группу; опиши только видимые детали — материал, текстуру, цвет, фурнитуру, упаковку, форму, размер, текст, этикетки, бренд, фон, освещение и предметы для масштаба. На основе визуала оцени стиль и назначение товара.
2. Сформулируй 5–7 преимуществ, превращая видимые свойства в выгоды покупателя. Не выдумывай состав, размеры, технологии, сертификацию или свойства, которых нельзя подтвердить по фото или дополнительной информации продавца. Если характеристика не видна, укажи «не указано» или не включай её.
3. Составь готовый текст карточки: заголовок до 60 символов с главным ключевым запросом, преимущества, краткие характеристики, 2–3 сценария «для кого и зачем», 3–5 естественных SEO-ключей и призыв к действию.
4. Общий объём всех текстовых полей карточки — не более 1000 символов с пробелами. Тон уверенный и дружелюбный, без канцелярита, воды и неподтверждённых обещаний. Не используй шаблонное «высокое качество» без доказательств.
  5. Если на фото есть явный недостаток, который влияет на подачу товара, тактично учти его в description или designStyle. Не добавляй комментарии вне JSON. Не добавляй названия, логотипы, водяные знаки или визуальную символику конкретных площадок и сервисов.

Ответь ТОЛЬКО в формате JSON без markdown, строго следуя этой структуре:
{
  "title": "Короткое продающее название (до 60 символов)",
  "description": "Краткое описание товара и его главной ценности (2–3 предложения)",
  "benefits": ["Выгода 1", "Выгода 2", "Выгода 3", "Выгода 4", "Выгода 5"],
  "characteristics": ["Материал: ...", "Цвет: ...", "Размер / объём / вес: ...", "Комплектация: ..."],
  "useCases": ["Для кого и зачем: ...", "Сценарий использования: ..."],
  "keywords": ["ключевой запрос 1", "ключевой запрос 2", "ключевой запрос 3"],
  "callToAction": "Призыв к действию (до 60 символов)",
  "designStyle": "Описание стиля дизайна карточки",
  ${promptField}
 }

Поля characteristics, useCases и keywords должны быть массивами строк. Если данных нет, верни пустой массив.`;

  // openai/gpt-5.4-mini — vision LLM Polza.ai (gpt-4o там нет, используем их аналог)
  const response = await getOpenAI().chat.completions.create({
    model: "openai/gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: `Проанализируй этот товар по заданному алгоритму и создай готовую карточку. Верни только JSON без пояснений.${notes ? `\n\nДополнительная информация от продавца (учти её, но не противоречь видимому на фото): ${notes}` : ""}`,
          },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error(`[analyzeWithGpt] \u2717 JSON parse error: ${(parseErr as Error).message}`);
    console.error(`[analyzeWithGpt] \u2717 Content length=${content.length} cleaned length=${cleaned.length}`);
    console.error(`[analyzeWithGpt] \u2717 Content preview: ${content.substring(0, 500)}`);
    console.error(`[analyzeWithGpt] \u2717 Cleaned preview: ${cleaned.substring(0, 500)}`);
    throw new Error(`\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0430\u0440\u0441\u0438\u043d\u0433\u0430 JSON \u043e\u0442 GPT: ${(parseErr as Error).message}`);
  }
}

// Создаём текстовые идеи для поля "О чём рассказать" — только русский текст, без JSON
async function suggestNotes(imageBase64: string, mimeType: string): Promise<string> {
  const systemPrompt = `Ты — топ-маркетолог мирового уровня. Проанализируй фото товара и напиши 4–5 преимуществ или уникальных свойств в продающей форме, которые было бы полезно указать продавцу для карточки на маркетплейсе.
Напиши только русский текст без любой разметки, без заголовков, без перечислений. Только плотное полезное описание, как будто продавец сам описывает свой товар. Одно предложение, до 300 символов.`;

  const response = await getOpenAI().chat.completions.create({
    model: "openai/gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
          { type: "text", text: "Напиши преимущества этого товара для карточки на маркетплейсе. Только текст, без форматирования." },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.8,
  });

  return (response.choices[0]?.message?.content || "").trim();
}

// Polza.ai — генерация карточки товара через /api/v1/media
async function generateCardWithPolza(
  imageBuffer: Buffer,
  _filename: string,
  mimeType: string,
  prompt: string,
  aspectRatio: string = "1:1",
  model: string = "nano-banana-2",
  noText: boolean = false,
): Promise<string> {
  const polzaModelId = POLZA_MODEL_MAP[model] || POLZA_MODEL_MAP["nano-banana-2"];
  const resolution = modelToResolution(model);

  const fullPrompt = noText
    ? `${prompt}

Important requirements:
 - Create a clean professional product card based on the provided photo
- Use modern clean design with gradient or white background
- Beautiful product showcase with perfect lighting and shadows
- NO text, NO text overlays, NO captions, NO labels, NO badges with text anywhere in the image
- Only the product and a clean, professional background`
    : `${prompt}

Important requirements:
- Create a professional marketplace product card based on the provided photo
- Add Russian text overlays highlighting product benefits
- Use modern clean design with gradient or white background
 - Include only neutral decorative elements; never add marketplace/platform logos, watermarks, or platform-specific symbols
- Make it visually striking and sales-focused
- All text overlays must be in Russian language`;

  console.log(`[polza.ai] ▶ generateCard polzaModel=${polzaModelId} ratio=${aspectRatio} res=${resolution}`);

  return callPolzaMedia({
    polzaModelId,
    prompt: fullPrompt,
    aspectRatio,
    imageResolution: resolution,
    images: [{ buffer: imageBuffer, mimeType }],
  });
}

// Polza.ai — виртуальная примерка одежды через /api/v1/media
async function generateTryonWithPolza(
  personBuffer: Buffer,
  _personFilename: string,
  personMime: string,
  garmentFiles: Express.Multer.File[],
): Promise<string> {
  const polzaModelId = POLZA_MODEL_MAP["nano-banana-2"];
  console.log(`[polza.ai] ▶ generateTryon polzaModel=${polzaModelId} garments=${garmentFiles.length}`);

  const garmentDesc = garmentFiles.map((f, i) => {
    const name = f.originalname.replace(/\.[^.]+$/, "");
    return `${i + 1}. ${name}`;
  }).join("; ");

  const prompt = `Fashion editorial photo. The model (first image) is photographed wearing the following clothing items: ${garmentDesc}. Preserve the model's original pose, face, hair and background. The clothing items are displayed on the model exactly as they would appear in a professional fashion catalog. Combine all items into a cohesive outfit. High quality studio photography, natural lighting, clean result, no distortions.`;

  return callPolzaMedia({
    polzaModelId,
    prompt,
    aspectRatio: "2:3",
    imageResolution: "1K",
    images: [
      { buffer: personBuffer, mimeType: personMime },
      ...garmentFiles.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })),
    ],
  });
}

// Polza.ai — видео оживление кадра товара (image-to-video) через /api/v1/media
// Видео-модели используют image_url (строка) вместо images массива
async function generateVideoWithPolza(
  imageBuffer: Buffer,
  _filename: string,
  mimeType: string,
  prompt: string,
  duration: string,
  aspectRatio: string,
): Promise<string> {
  const videoModelId = "wan/2.5";
  console.log(`[polza.ai] ▶ generateVideo (image-to-video) model=${videoModelId} duration=${duration}s ratio=${aspectRatio}`);

  const dataUri = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const videoPrompt = prompt
    ? `Fashion editorial video: the model in the image gracefully demonstrates the outfit, slightly shifts pose and weight, turns to show the garment from different angles. ${prompt}. Professional studio lighting, smooth natural movement, premium fashion shoot quality.`
    : "Fashion editorial video: the model in the image gracefully demonstrates the outfit, slightly shifts pose and weight, turns to show the garment from different angles. Professional studio lighting, smooth natural movement, premium fashion shoot quality.";

  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) throw new Error("POLZA_API_KEY не задан");

  const body = {
    model: videoModelId,
    input: {
      prompt: videoPrompt,
      duration: String(duration),
      image_url: dataUri,
      aspect_ratio: aspectRatio,
    },
  };

  const resp = await fetch("https://polza.ai/api/v1/media", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Polza.ai ${resp.status}: ${text.substring(0, 300)}`);
  }

  let result: any;
  try { result = JSON.parse(text); } catch { throw new Error(`Polza.ai invalid JSON: ${text.substring(0, 200)}`); }

  console.log(`[polza.ai/video] ← status=${result.status} id=${result.id}`);

  if (result.status === "completed" || result.status === "done" || result.status === "succeeded") {
    const url = extractMediaUrl(result.data);
    if (url) { console.log(`[polza.ai/video] ✓ sync done`); return url; }
  }

  if (result.id && (result.status === "pending" || result.status === "processing" || result.status === "in_progress")) {
    return await pollPolzaMedia(result.id, apiKey);
  }

  const directUrl = extractMediaUrl(result.data ?? result);
  if (directUrl) return directUrl;

  throw new Error(`Polza.ai неожиданный ответ: ${JSON.stringify(result).substring(0, 300)}`);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // AI-идеи для поля "О чём рассказать" — на основе фото товара
  app.post("/api/suggest-notes", upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "И\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e" });
      const imageBase64 = req.file.buffer.toString("base64");
      const notes = await suggestNotes(imageBase64, req.file.mimetype);
      res.json({ notes });
    } catch (err: any) {
      console.error("[suggest-notes] О\u0448\u0438\u0431\u043a\u0430:", err.message);
      res.status(500).json({ error: err.message || "О\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438" });
    }
  });

  app.post("/api/generate", upload.single("image"), async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || "";
      if (!userId) {
        return res.status(401).json({ error: "Необходима авторизация для генерации" });
      }
      if (!req.file) {
        console.log(`[generate] ✗ No image provided`);
        return res.status(400).json({ error: "Изображение не загружено" });
      }

      const imageBuffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const filename = req.file.originalname || "product.jpg";
      const imageBase64 = imageBuffer.toString("base64");
      const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

      const model = (req.body?.model as string) || "nano-banana-pro";
      const aspectRatio = (req.body?.aspectRatio as string) || "1:1";
      const notes = (req.body?.notes as string) || "";
      const noText = req.body?.noText === "true";
      const username = (req.body?.username as string) || "";
      if (username) storage.trackUser(username).catch(() => {});
      const resolution = model === "nano-banana-2" ? "1K" : "2K";

      const requestedUser = await storage.getAppUserById(userId);
      if (!requestedUser) return res.status(401).json({ error: "Пользователь не найден" });
      if (model === "nano-banana-pro" && effectiveCards(requestedUser.proSubscription) === 0) {
        return res.status(403).json({ error: "Доступен при покупке тарифа" });
      }

      // Сервер — источник истины по балансу/пробным попыткам, а не клиент.
      const feature: TrialFeature = model === "nano-banana-2" ? "nano2" : "pro";
      const entitlement = await storage.consumeEntitlement(userId, feature);
      if (!entitlement) {
         return res.status(403).json({
           error: feature === "nano2"
             ? "Лимит пробных карточек исчерпан. Для продолжения приобретите платный пакет"
             : "Нет доступных генераций. Пополните баланс.",
         });
      }

      console.log(`[generate] ▶ START file=${filename} size=${imageBuffer.length}b model=${model} ratio=${aspectRatio} noText=${noText} notes="${notes.substring(0, 50)}${notes.length > 50 ? "..." : ""}" userId=yes trial=${entitlement.usedTrial}`);

      let generation: Awaited<ReturnType<typeof storage.createGeneration>>;
      try {
        generation = await storage.createGeneration({
          userId,
          sessionId: null,
          originalImageUrl: imageDataUrl,
          status: "analyzing",
          model,
          aspectRatio,
          notes: notes || null,
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        });
      } catch (err: any) {
        await storage.refundEntitlement(userId, feature, entitlement.usedTrial);
        throw err;
      }

      console.log(`[generate] ✓ Generation record created id=${generation.id}`);

      res.json({ id: generation.id, status: "analyzing" });
      console.log(`[generate] ✓ Response sent to client, starting background task`);

      (async () => {
        try {
          console.log(`[generate] ▶ GPT-4o analysis starting for id=${generation.id}...`);
          const analysis = await analyzeWithGpt(imageBase64, mimeType, notes, noText);
          console.log(`[generate] ✓ GPT analysis done title="${analysis.title}" designStyle="${analysis.designStyle}"`);

          await storage.updateGeneration(generation.id, {
            gptAnalysis: analysis,
            status: "uploading",
          });
          console.log(`[generate] ✓ Status → uploading`);

          await storage.updateGeneration(generation.id, { status: "generating" });
          console.log(`[generate] ✓ Status → generating, calling Polza.ai...`);

          const resultUrl = await generateCardWithPolza(imageBuffer, filename, mimeType, analysis.prompt, aspectRatio, model, noText);
          const finalUrl = await processResultImage(resultUrl, entitlement.usedTrial);
          await storage.updateGeneration(generation.id, { status: "done", resultImageUrl: finalUrl, usedTrial: entitlement.usedTrial });
          if (username) storage.incrementUserGenerations(username).catch(() => {});
          console.log(`[generate] ✓ Polza.ai done id=${generation.id} trial=${entitlement.usedTrial} url=${finalUrl.substring(0, 80)}...`);

        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          const message = err.message || "Неизвестная ошибка";
          console.error(`[generate] ✗ BACKGROUND ERROR id=${generation.id}: ${message}${axiosDetail}`);
          await storage.updateGeneration(generation.id, { status: "error", errorMessage: message + axiosDetail });
          storage.addErrorLog({ username, model, errorMessage: message + axiosDetail, generationType: "card" }).catch(() => {});
          await storage.refundEntitlement(userId, feature, entitlement.usedTrial);
        }
      })();

    } catch (err: any) {
      console.error(`[generate] ✗ FATAL ERROR: ${err.message}`);
      res.status(500).json({ error: err.message || "Ошибка сервера" });
    }
  });

  app.post("/api/generate-video", upload.single("image"), async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || "";
      if (!userId) {
        return res.status(401).json({ error: "Необходима авторизация для генерации" });
      }
      if (!req.file) return res.status(400).json({ error: "Изображение не загружено" });

      const imageBuffer = req.file.buffer;
      const filename = req.file.originalname || "product.jpg";
      const duration = parseInt(req.body?.duration as string) || 5;
      const prompt = (req.body?.prompt as string) || "";

      console.log(`[generate-video] ▶ START file=${filename} duration=${duration}s`);

      const generation = await storage.createGeneration({
        userId,
        sessionId: null,
        originalImageUrl: `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`,
        status: "generating",
        model: "nano-banana-2",
        aspectRatio: "9:16",
        generationType: "video",
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });

      res.json({ id: generation.id, status: "generating" });

      (async () => {
        try {
          console.log(`[generate-video] ▶ Calling Polza.ai for video frame id=${generation.id}`);
          const resultUrl = await generateVideoWithPolza(imageBuffer, filename, req.file!.mimetype, prompt, String(duration), "9:16");
          await storage.updateGeneration(generation.id, { status: "done", resultImageUrl: resultUrl });
          console.log(`[generate-video] ✓ Polza.ai done id=${generation.id} url=${resultUrl.substring(0, 80)}...`);
        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          console.error(`[generate-video] ✗ ERROR id=${generation.id}: ${err.message}${axiosDetail}`);
          await storage.updateGeneration(generation.id, { status: "error", errorMessage: err.message + axiosDetail });
          storage.addErrorLog({ username: (req.body?.username as string) || "", model: "nano-banana-2", errorMessage: err.message + axiosDetail, generationType: "video" }).catch(() => {});
        }
      })();

    } catch (err: any) {
      console.error(`[generate-video] ✗ FATAL: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/generate-tryon", upload.fields([
    { name: "person", maxCount: 1 },
    { name: "garment", maxCount: 5 },
  ]), async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || "";
      if (!userId) {
        return res.status(401).json({ error: "Необходима авторизация для генерации" });
      }
      const files = req.files as Record<string, Express.Multer.File[]>;
      const personFile = files?.person?.[0];
      const garmentFiles = files?.garment || [];

      if (!personFile || garmentFiles.length === 0) {
        return res.status(400).json({ error: "Нужны фото модели и хотя бы 1 элемент одежды" });
      }

      const entitlement = await storage.consumeEntitlement(userId, "tryon");
      if (!entitlement) {
        return res.status(403).json({ error: "Нет доступных генераций. Пополните баланс." });
      }

      console.log(`[generate-tryon] ▶ START person=${personFile.originalname} garments=${garmentFiles.length} trial=${entitlement.usedTrial}`);

      let generation: Awaited<ReturnType<typeof storage.createGeneration>>;
      try {
        generation = await storage.createGeneration({
          userId,
          sessionId: null,
          originalImageUrl: `data:${personFile.mimetype};base64,${personFile.buffer.toString("base64")}`,
          status: "generating",
          model: "nano-banana-2",
          aspectRatio: "9:16",
          generationType: "tryon",
          expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        });
      } catch (err: any) {
        await storage.refundEntitlement(userId, "tryon", entitlement.usedTrial);
        throw err;
      }

      res.json({ id: generation.id, status: "generating" });

      (async () => {
        try {
          console.log(`[generate-tryon] ▶ Calling Polza.ai for tryon id=${generation.id}`);
          const resultUrl = await generateTryonWithPolza(
            personFile.buffer, personFile.originalname, personFile.mimetype,
            garmentFiles,
          );
          const finalUrl = await processResultImage(resultUrl, entitlement.usedTrial);
          await storage.updateGeneration(generation.id, { status: "done", resultImageUrl: finalUrl, usedTrial: entitlement.usedTrial });
          console.log(`[generate-tryon] ✓ Polza.ai done id=${generation.id} trial=${entitlement.usedTrial} url=${finalUrl.substring(0, 80)}...`);
        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          console.error(`[generate-tryon] ✗ ERROR id=${generation.id}: ${err.message}${axiosDetail}`);
          await storage.updateGeneration(generation.id, { status: "error", errorMessage: err.message + axiosDetail });
          storage.addErrorLog({ username: (req.body?.username as string) || "", model: "nano-banana-2", errorMessage: err.message + axiosDetail, generationType: "tryon" }).catch(() => {});
          await storage.refundEntitlement(userId, "tryon", entitlement.usedTrial);
        }
      })();

    } catch (err: any) {
      console.error(`[generate-tryon] ✗ FATAL: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // Polza.ai синхронный — статус обновляется фоновой задачей напрямую.
  // Клиент поллит каждые 3 сек, пока status !== "done" | "error"
  app.get("/api/generation/:id", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Не авторизован" });
      const generationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const generation = await storage.getGeneration(generationId);
      if (!generation || generation.userId !== userId) {
        console.log(`[poll] ✗ id=${req.params.id} NOT FOUND or not owned by userId=${userId}`);
        return res.status(404).json({ error: "Не найдено" });
      }
      console.log(`[poll] ▶ id=${generation.id} status=${generation.status}`);
      return res.json(generation);
    } catch (err: any) {
      console.error(`[poll] ✗ ERROR id=${req.params.id}: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/proxy-image", async (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "url required" });
    if (!isTrustedImageUrl(url)) {
      return res.status(403).json({ error: "URL не разрешён" });
    }
    try {
      // Поддержка data-URL для watermarked trial-изображений, сгенерированных на сервере.
      if (url.startsWith("data:")) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Invalid data URL" });
        const contentType = match[1] || "image/png";
        const buffer = Buffer.from(match[2], "base64");
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.send(buffer);
        return;
      }
      const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      const contentType = String(response.headers["content-type"] || "image/png");
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(response.data));
    } catch (err: any) {
      res.status(502).json({ error: "Failed to fetch image" });
    }
  });

  app.get("/api/generations", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId as string | undefined;
      if (!userId) {
        return res.json([]);
      }
      const gens = await storage.listGenerations({ userId });
      res.json(gens);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Промокоды: код → количество звёзд
  const PROMO_CODES: Record<string, number> = {
    "KARDOMATIC_DEV":    100,
    "KARDOMATIC50":      50,
    "KARDOMATIC_TESTER": 50,
    "KARDOMATIC_BETA":   40,
    "KARDOMATIC_EARLY":  30,
    "KARDOMATIC_FRIEND": 25,
    "DEV2":              100,
    "DEV3":              100,
    "WELCOME":           20,
  };

  app.post("/api/promo/redeem", (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: "Промокод не указан" });

    const normalized = code.trim().toUpperCase();
    const stars = PROMO_CODES[normalized];
    if (!stars) return res.status(404).json({ error: "Промокод не найден или уже использован" });

    console.log(`[promo] ✓ code=${normalized} stars=${stars}`);
    return res.json({ stars, message: `+${stars} ⭐ зачислено!` });
  });

  // Промокод разработчика — пополняет карточки и выдаёт флаг is_developer
  app.post("/api/promo/dev-cards", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: "Код не указан" });
    const memStorage = storage as MemStorage;
    const codeOk = code.trim() === DEV_PROMO_CODE ||
      (!!memStorage.adminOverrideCode && code.trim() === memStorage.adminOverrideCode);
    if (!codeOk) {
      return res.status(403).json({ error: "Неверный код разработчика" });
    }
    // Начисление происходит здесь же, на сервере — клиент лишь узнаёт результат.
    const user = await storage.grantDeveloperCredit(userId, 100, 100);
    console.log(`[promo/dev] ✓ developer code activated userId=${userId}`);
    return res.json({ ...serializeAppUser(user), message: "Баланс пополнен: +100 Nano2, +100 Pro" });
  });

  // Трекинг пользователя при входе
  app.post("/api/user/track", async (req: Request, res: Response) => {
    const { username } = req.body as { username?: string };
    if (!username) return res.status(400).json({ error: "username обязателен" });
    const user = await storage.trackUser(username.trim());
    return res.json({ ok: true, user });
  });

  // Получить отложенные зачисления для пользователя
  app.get("/api/user/pending-credits", async (req: Request, res: Response) => {
    const username = (req.query.username as string) || "";
    if (!username) return res.status(400).json({ error: "username обязателен" });
    const credits = await storage.consumePendingCredits(username);
    return res.json(credits);
  });

  // ===== ADMIN API (только для разработчика) =====

  app.get("/api/admin/users", adminOnly, async (_req: Request, res: Response) => {
    const users = await storage.getAllServerUsers();
    return res.json(users);
  });

  app.post("/api/admin/users/:username/balance", adminOnly, async (req: Request, res: Response) => {
    const username = req.params.username as string;
    const { nano2Delta, proDelta } = req.body as { nano2Delta?: number; proDelta?: number };
    if (!nano2Delta && !proDelta) {
      return res.status(400).json({ error: "nano2Delta или proDelta обязательны" });
    }
    if ((nano2Delta && nano2Delta <= 0) || (proDelta && proDelta <= 0)) {
      return res.status(400).json({ error: "Сумма пополнения должна быть положительной" });
    }
    const model: "nano2" | "pro" = proDelta ? "pro" : "nano2";
    const amount = proDelta || nano2Delta || 0;
    // Начисление немедленное — требует существующего аккаунта (email-регистрация).
    const updated = await storage.creditAppUserBalanceByUsername(username, model, amount);
    if (!updated) {
      return res.status(404).json({ error: "У пользователя ещё нет аккаунта — начислить баланс нельзя" });
    }
    const actor = adminActorLabel(req);
    console.log(`[admin] ✓ credit_balance actor=${actor} target=${username} model=${model} amount=${amount} at=${new Date().toISOString()} newNano2=${updated.nano2Balance} newPro=${updated.proBalance}`);
    return res.json({ ok: true, nano2Balance: updated.nano2Balance, proBalance: updated.proBalance });
  });

  app.post("/api/admin/users/:username/reset-balance", adminOnly, async (req: Request, res: Response) => {
    const username = req.params.username as string;
    await storage.addPendingCredits(username, -99999, -99999);
    console.log(`[admin] balance reset pending for ${username}`);
    return res.json({ ok: true });
  });

  app.post("/api/admin/users/:username/reset-password", adminOnly, async (req: Request, res: Response) => {
    const username = req.params.username as string;
    const chars = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const newPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const ok = await storage.resetUserPassword(username, passwordHash);
    if (!ok) return res.status(404).json({ error: "Пользователь не найден" });
    const actor = adminActorLabel(req);
    console.log(`[admin] ✓ reset_password actor=${actor} target=${username} at=${new Date().toISOString()}`);
    return res.json({ ok: true, newPassword });
  });

  app.get("/api/admin/payments", adminOnly, async (_req: Request, res: Response) => {
    const payments = await storage.listPayments();
    return res.json(payments);
  });

  app.get("/api/admin/logs", adminOnly, async (_req: Request, res: Response) => {
    const logs = await storage.getErrorLogs();
    return res.json(logs);
  });

  app.post("/api/admin/forgot-code", async (req: Request, res: Response) => {
    const { identifier } = req.body as { identifier?: string };
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: "Укажите идентификатор (e.g. 'admin')" });
    }
    const memStorage = storage as MemStorage;
    const token = memStorage.generateAdminResetToken();
    const host = req.headers.host || "localhost:5000";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const resetLink = `${proto}://${host}/admin?token=${token}`;
    console.log(`\n[admin/forgot-code] Запрос от: ${identifier.trim()}`);
    console.log(`[admin/forgot-code] TOKEN: ${token}`);
    console.log(`[admin/forgot-code] ССЫЛКА: ${resetLink}`);
    console.log(`[admin/forgot-code] Действителен 15 минут\n`);
    return res.json({ ok: true });
  });

  app.post("/api/admin/reset-code", async (req: Request, res: Response) => {
    const { token, newCode } = req.body as { token?: string; newCode?: string };
    if (!token || !newCode || newCode.trim().length < 4) {
      return res.status(400).json({ error: "Укажите токен и новый код (минимум 4 символа)" });
    }
    const memStorage = storage as MemStorage;
    const ok = memStorage.consumeAdminResetToken(token.trim(), newCode.trim());
    if (!ok) {
      return res.status(400).json({ error: "Токен недействителен или истёк" });
    }
    console.log(`[admin/reset-code] Код доступа изменён (действует до перезапуска сервера)`);
    return res.json({ ok: true });
  });

  app.post("/api/payment/create", async (req: Request, res: Response) => {
    try {
      const { planId, planType, packageId } = req.body as { planId?: string; planType?: string; packageId?: string };

      // New package-based flow
      if (packageId) {
        const sessionUserId = req.session?.userId;
        if (!sessionUserId) {
          return res.status(401).json({ error: "Войдите в аккаунт перед оплатой" });
        }
        const sessionUser = await storage.getAppUserById(sessionUserId);
        if (!sessionUser) {
          return res.status(401).json({ error: "Пользователь не найден. Войдите снова." });
        }
        console.log(`[payment/create] ▶ START packageId=${packageId}`);
        const pkg = PACKAGE_DATA[packageId];
        if (!pkg) {
          console.log(`[payment/create] ✗ package NOT FOUND packageId=${packageId}`);
          return res.status(400).json({ error: "Пакет не найден" });
        }
        console.log(`[payment/create] ✓ package found: ${pkg.name} price=${pkg.price} cards=${pkg.cardsIncluded} model=${pkg.modelType}`);

        const amount = getTestPrice(pkg.price);
        const label = `pkg-${packageId}-${sessionUserId}-${Date.now()}`;
        const comment = `КардоМатик: ${pkg.name}`;
        const username = sessionUser.username;
        console.log(`[payment/create] ✓ amount=${amount}₽ label=${label} user=${username || "anon"}`);

        const wallet = process.env.VITE_YOOMONEY_WALLET || "";
        if (!wallet) console.warn(`[payment/create] ⚠ VITE_YOOMONEY_WALLET not set`);

        const host = req.get("host") || "localhost:5000";
        const proto = req.headers["x-forwarded-proto"] || req.protocol;
        const successURL = `${proto}://${host}/payment-success?label=${encodeURIComponent(label)}&cards=${pkg.cardsIncluded}&model=${pkg.modelType}`;
        console.log(`[payment/create] ✓ successURL=${successURL}`);

        const params = new URLSearchParams({
          receiver: wallet,
          "quickpay-form": "button",
          sum: String(amount),
          label,
          comment,
          successURL,
        });
        const url = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;

        const starsIncluded = packageId.endsWith("-10") ? 10 : pkg.cardsIncluded;
        await storage.recordPayment({ label, starsToAdd: starsIncluded, cardsIncluded: pkg.cardsIncluded, modelType: pkg.modelType, operationId: "", amount: String(amount), username, userId: sessionUserId });
        console.log(`[payment/create] ✓ DONE returning url for package`);
        return res.json({ url, label, cards: pkg.cardsIncluded, model: pkg.modelType });
      }

      // Legacy stars-based flow (kept for backward compat)
      const id = planId || "";
      console.log(`[payment/create] ▶ START planId=${id} planType=${planType}`);

      const plan = PLAN_DATA[id];
      if (!plan) {
        console.log(`[payment/create] ✗ plan NOT FOUND planId=${id}`);
        return res.status(400).json({ error: "Тариф не найден" });
      }
      console.log(`[payment/create] ✓ plan found: ${plan.name} price=${plan.price} stars=${plan.starsIncluded}`);

      const amount = getTestPrice(plan.price);
      const label = `${planType}-${id}-${Date.now()}`;
      const comment = `КардоМатик: "${plan.name}"`;
      console.log(`[payment/create] ✓ amount=${amount}₽ (${TEST_MODE ? "TEST" : "REAL"}) label=${label}`);

      const wallet = process.env.VITE_YOOMONEY_WALLET || "";
      console.log(`[payment/create] ✓ wallet=${wallet ? wallet.substring(0, 6) + "..." : "NOT SET"}`);

      const host = req.get("host") || "localhost:5000";
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const successURL = `${proto}://${host}/payment-success?label=${encodeURIComponent(label)}&stars=${plan.starsIncluded}`;
      console.log(`[payment/create] ✓ successURL=${successURL}`);

      const params = new URLSearchParams({
        receiver: wallet,
        "quickpay-form": "button",
        sum: String(amount),
        label,
        comment,
        successURL,
      });
      const url = `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;

      await storage.recordPayment({ label, starsToAdd: plan.starsIncluded, cardsIncluded: 0, modelType: "", operationId: "", amount: String(amount), username: (req.session as any)?.username || "", userId: req.session?.userId || null });
      console.log(`[payment/create] ✓ payment recorded in storage`);

      console.log(`[payment/create] ✓ DONE returning url`);
      return res.json({ url, label, stars: plan.starsIncluded });

    } catch (err: any) {
      console.error(`[payment/create] ✗ ERROR: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Внутренняя ошибка сервера" });
      }
    }
  });

  app.post("/api/payment/confirm", async (req: Request, res: Response) => {
    const { label } = req.body as { label?: string };
    if (!label) return res.status(400).json({ error: "label required" });
    console.log(`[payment/confirm] ▶ label=${label}`);
    const payment = await storage.confirmPayment(label);
    console.log(`[payment/confirm] ${payment ? "✓ confirmed" : "✗ not found in storage"}`);
    res.json({ ok: true });
  });

  // ЮMoney webhook — верификация SHA-1 подписи и подтверждение платежа
  app.post("/api/payment/webhook", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    try {
      console.log(`[payment/webhook] ▶ received notification`, req.body);

      const {
        notification_type,
        operation_id,
        amount,
        currency,
        datetime,
        sender,
        codepro,
        label,
        sha1_hash,
      } = req.body as Record<string, string>;

      // Verify SHA-1 signature
      const secret = YM_NOTIFY_SECRET;
      if (secret) {
        const checkString = [
          notification_type,
          operation_id,
          amount,
          currency,
          datetime,
          sender || "",
          codepro || "",
          secret,
          label || "",
        ].join("&");
        const expectedHash = crypto.createHash("sha1").update(checkString).digest("hex");
        if (expectedHash !== sha1_hash) {
          console.warn(`[payment/webhook] ✗ SHA-1 mismatch expected=${expectedHash} got=${sha1_hash}`);
          return res.status(400).send("bad signature");
        }
        console.log(`[payment/webhook] ✓ SHA-1 verified`);
      } else {
        console.warn(`[payment/webhook] ⚠ YOOMONEY_NOTIFICATION_SECRET not set — skipping signature check`);
      }

      if (!label) {
        console.warn(`[payment/webhook] ⚠ no label in notification, ignoring`);
        return res.status(200).send("ok");
      }

      // Save operation_id and confirm payment. If the process restarted after
      // payment creation, rebuild the pending package record from the label.
      await storage.updatePaymentOperationId(label, operation_id || "");
      let confirmed = await storage.confirmPayment(label);
      if (!confirmed) {
        const recovered = parsePackagePaymentLabel(label);
        const packageData = recovered ? PACKAGE_DATA[recovered.packageId] : undefined;
        if (recovered && packageData) {
          const paidAmount = Number(amount);
           const expectedAmount = getTestPrice(packageData.price);
           if (Number.isFinite(paidAmount) && (paidAmount <= 0 || paidAmount > expectedAmount + 0.01 || paidAmount < expectedAmount * 0.9)) {
             console.warn(`[payment/webhook] ✗ amount mismatch label=${label} expected=${expectedAmount} got=${amount}`);
            return res.status(400).send("amount mismatch");
          }
          await storage.recordPayment({
            label,
            starsToAdd: recovered.packageId.endsWith("-10") ? 10 : packageData.cardsIncluded,
            cardsIncluded: packageData.cardsIncluded,
            modelType: packageData.modelType,
            operationId: operation_id || "",
            amount: String(amount || packageData.price),
            username: "",
            userId: recovered.userId,
          });
          confirmed = await storage.confirmPayment(label);
          console.log(`[payment/webhook] ✓ recovered payment record label=${label}`);
        }
      }
      if (confirmed) {
        console.log(`[payment/webhook] ✓ payment confirmed label=${label} operationId=${operation_id} amount=${amount}`);
        // Начисляем пакет сразу из webhook. Возврат пользователя на successURL
        // не должен быть обязательным условием для пополнения баланса.
        const ownerId = confirmed.userId || (await storage.getAppUserByUsername(confirmed.username))?.id;
        if (ownerId && !confirmed.credited) {
          const credited = await storage.creditConfirmedPayment(label, ownerId);
          console.log(`[payment/webhook] ${credited ? "✓ credited" : "⚠ credit skipped"} label=${label} userId=${ownerId}`);
        } else if (!ownerId) {
          console.warn(`[payment/webhook] ⚠ payment has no user owner label=${label} username=${confirmed.username || "empty"}`);
        }
      } else {
        console.warn(`[payment/webhook] ⚠ payment label not found in storage: ${label}`);
      }

      res.status(200).send("ok");
    } catch (err: any) {
      console.error(`[payment/webhook] ✗ ERROR: ${err.message}`);
      res.status(500).send("error");
    }
  });

  // Проверка статуса платежа по label — клиент использует этот эндпоинт вместо URL-параметров.
  // Начисление баланса выполняется здесь же, атомарно на сервере (не клиентом),
  // и только один раз на подтверждённый платёж — это единственный источник истины по балансу.
  app.get("/api/payment/verify", async (req: Request, res: Response) => {
    const label = req.query.label as string;
    if (!label) return res.status(400).json({ error: "label required" });

    let payment = await storage.getPaymentByLabel(label);
    // Webhook delivery is not guaranteed. When the customer returns to the
    // success page, verify the operation directly through YooMoney as well.
    if (payment && !payment.confirmed) {
      const operation = await verifyYooMoneyPayment(label, payment.amount);
      if (operation) {
        await storage.updatePaymentOperationId(label, operation.operationId);
        payment = await storage.confirmPayment(label);
      }
    }

    // A process restart can remove the in-memory payment record. For package
    // labels, recover the pending order only after YooMoney confirms the exact
    // package amount.
    if (!payment) {
      const recovered = parsePackagePaymentLabel(label);
      const packageData = recovered ? PACKAGE_DATA[recovered.packageId] : undefined;
      if (recovered && packageData) {
        const operation = await verifyYooMoneyPayment(label, String(getTestPrice(packageData.price)));
        if (operation) {
          await storage.recordPayment({
            label,
            starsToAdd: 0,
            cardsIncluded: packageData.cardsIncluded,
            modelType: packageData.modelType,
            operationId: operation.operationId,
            amount: operation.amount,
            username: "",
            userId: recovered.userId,
          });
          payment = await storage.confirmPayment(label);
        }
      }
    }

    if (!payment) {
      console.log(`[payment/verify] ✗ label not found: ${label}`);
      return res.json({ paid: false, found: false });
    }

    if (!payment.confirmed) {
      console.log(`[payment/verify] ⏳ label=${label} not yet confirmed`);
      return res.json({ paid: false, found: true });
    }

    // При возврате от платёжной системы сессия может быть потеряна.
    // В таком случае используем владельца, сохранённого при создании платежа.
    const userId = req.session?.userId || payment.userId || (await storage.getAppUserByUsername(payment.username))?.id;
    let creditedUser: Awaited<ReturnType<typeof storage.getAppUserById>> | null = undefined;
    if (userId && !payment.credited) {
      creditedUser = await storage.creditConfirmedPayment(label, userId);
      if (creditedUser) {
        console.log(`[payment/verify] ✓ credited label=${label} to userId=${userId}`);
      } else {
        console.warn(`[payment/verify] ⚠ confirmed payment could not be credited label=${label} userId=${userId}`);
      }
    }

    const latestPayment = await storage.getPaymentByLabel(label);
    const latestUser = creditedUser || (userId ? await storage.getAppUserById(userId) : undefined);
    const credited = Boolean(latestPayment?.credited);
    console.log(`[payment/verify] ✓ label=${label} confirmed cards=${payment.cardsIncluded} model=${payment.modelType} stars=${payment.starsToAdd} credited=${credited}`);
    return res.json({
      paid: true,
      found: true,
      cards: payment.cardsIncluded,
      model: payment.modelType,
      stars: payment.starsToAdd,
      credited,
      balance: latestUser
        ? {
            nano2: latestUser.nano2Balance,
            pro: latestUser.proBalance,
            stars: latestUser.starsBalance,
          }
        : null,
    });
  });

  // ===== Telegram Bot Webhook и Support API =====
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
  const TELEGRAM_API_BASE = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : "";

  async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) return false;
    try {
      const resp = await axios.post(`${TELEGRAM_API_BASE}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      });
      return resp.data?.ok === true;
    } catch (err: any) {
      console.error(`[telegram] sendMessage error: ${err.message}`);
      return false;
    }
  }

  // Telegram webhook — публичный, без авторизации
  app.post("/api/telegram/webhook", express.json(), async (req: Request, res: Response) => {
    try {
      const { message, callback_query } = req.body;
      if (message && message.text && message.from) {
        const telegramUserId = String(message.from.id);
        const text = message.text;
        const chatId = message.chat.id;
        console.log(`[telegram] message from ${telegramUserId}: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`);

        // Создаём или находим чат
        const supportChat = await storage.getOrCreateSupportChat(telegramUserId);
        // Сохраняем сообщение
        await storage.addSupportMessage({
          chatId: supportChat.id,
          telegramUserId,
          message: text,
          isFromUser: true,
          isRead: false,
        });
        // Авто-ответ пользователю
        await sendTelegramMessage(chatId, "Ваше сообщение передано оператору. Ответим в ближайшее время.");
      }
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error(`[telegram] webhook error: ${err.message}`);
      res.status(200).json({ ok: true });
    }
  });

  // Админ маршруты поддержки
  app.get("/api/support/chats", adminOnly, async (_req: Request, res: Response) => {
    const chats = await storage.listSupportChats();
    const withUnread = await Promise.all(
      chats.map(async (chat) => ({
        ...chat,
        unreadCount: await storage.countUnreadMessages(chat.id),
      }))
    );
    res.json(withUnread);
  });

  app.get("/api/support/chats/:chatId/messages", adminOnly, async (req: Request, res: Response) => {
    const chatId = req.params.chatId as string;
    const messages = await storage.getSupportMessages(chatId);
    res.json(messages);
  });

  app.post("/api/support/chats/:chatId/reply", adminOnly, async (req: Request, res: Response) => {
    const chatId = req.params.chatId as string;
    const { message } = req.body as { message?: string };
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Сообщение обязательно" });
    }

    const chat = await storage.getSupportChat(chatId);
    if (!chat) return res.status(404).json({ error: "Чат не найден" });

    // Сохраняем ответ в БД
    const reply = await storage.addSupportMessage({
      chatId,
      telegramUserId: null,
      message: message.trim(),
      isFromUser: false,
      isRead: true,
    });

    // Отправляем в Telegram
    const sent = await sendTelegramMessage(Number(chat.telegramUserId), message.trim());
    console.log(`[support] reply to chatId=${chatId} telegramId=${chat.telegramUserId} sent=${sent}`);

    res.json({ ok: true, message: reply, sent });
  });

  app.post("/api/support/chats/:chatId/read", adminOnly, async (req: Request, res: Response) => {
    const chatId = req.params.chatId as string;
    await storage.markMessagesRead(chatId);
    res.json({ ok: true });
  });

  app.post("/api/support/chats/:chatId/status", adminOnly, async (req: Request, res: Response) => {
    const chatId = req.params.chatId as string;
    const { status } = req.body as { status?: "open" | "closed" };
    if (!status || !["open", "closed"].includes(status)) {
      return res.status(400).json({ error: "status должен быть open или closed" });
    }
    const chat = await storage.updateSupportChatStatus(chatId, status);
    if (!chat) return res.status(404).json({ error: "Чат не найден" });
    res.json({ ok: true, chat });
  });

  // Перегенерация карточки с изменённым текстом
  app.post("/api/regenerate", async (req: Request, res: Response) => {
    try {
      const { generationId, analysis } = req.body as { generationId: string; analysis: any };
      if (!generationId || !analysis) {
        return res.status(400).json({ error: "generationId и analysis обязательны" });
      }

      const generation = await storage.getGeneration(generationId);
      if (!generation) {
        return res.status(404).json({ error: "Генерация не найдена" });
      }
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Авторизуйтесь, чтобы редактировать карточку" });
      if (generation.userId !== userId) {
        return res.status(403).json({ error: "Нет доступа к этой карточке" });
      }
      const currentUser = await storage.getAppUserById(userId);
      if (!currentUser || currentUser.starsBalance < 1) {
        return res.status(403).json({ error: "Недостаточно звёзд. Пополните баланс, купив пакет карточек." });
      }

      // Обновляем анализ и статус
      await storage.updateGeneration(generationId, {
        gptAnalysis: analysis,
        status: "generating",
      });
      console.log(`[regenerate] ▶ START id=${generationId} newTitle="${analysis.title}"`);

      res.json({ id: generationId, status: "generating" });

      // Фоновая генерация
      (async () => {
        try {
          // Получаем исходное изображение из оригинального URL
          const originalUrl = generation.originalImageUrl;
          let imageBuffer: Buffer;
          let mimeType = "image/jpeg";

          if (originalUrl.startsWith("data:")) {
            const match = originalUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              imageBuffer = Buffer.from(match[2], "base64");
            } else {
              throw new Error("Неверный формат data URL");
            }
          } else {
            // Скачиваем по внешнему URL
            const resp = await axios.get(originalUrl, { responseType: "arraybuffer", timeout: 15000 });
            imageBuffer = Buffer.from(resp.data);
            mimeType = String(resp.headers["content-type"] || "image/jpeg");
          }

          const prompt = buildRegeneratePrompt(analysis, generation.aspectRatio || "1:1");

          const resultUrl = await generateCardWithPolza(
            imageBuffer,
            "regenerated",
            mimeType,
            prompt,
            generation.aspectRatio || "1:1",
            generation.model || "nano-banana-pro",
          );

          const finalUrl = await processResultImage(resultUrl, generation.usedTrial || false);
          await storage.updateGeneration(generationId, {
            status: "done",
            resultImageUrl: finalUrl,
          });
          const charged = await storage.deductStars(userId, 1);
          if (!charged) {
            await storage.updateGeneration(generationId, {
              status: "error",
              errorMessage: "Недостаточно звёзд для завершения редактирования",
            });
            return;
          }
          console.log(`[regenerate] ✓ DONE id=${generationId} trial=${generation.usedTrial || false} url=${finalUrl.substring(0, 80)}...`);
        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          const message = err.message || "Неизвестная ошибка";
          console.error(`[regenerate] ✗ ERROR id=${generationId}: ${message}${axiosDetail}`);
          await storage.updateGeneration(generationId, {
            status: "error",
            errorMessage: message + axiosDetail,
          });
        }
      })();
    } catch (err: any) {
      console.error(`[regenerate] ✗ FATAL: ${err.message}`);
      res.status(500).json({ error: err.message || "Ошибка сервера" });
    }
  });

  // ===== ИИ ПОДБИРАЕТ ФОН =====
  app.post("/api/suggest-background", async (req: Request, res: Response) => {
    try {
      const { imageUrl } = req.body as { imageUrl: string };
      if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl обязателен" });
      }
      if (!isTrustedImageUrl(imageUrl)) {
        return res.status(400).json({ error: "Недопустимый URL изображения" });
      }

      let imageBuffer: Buffer;
      let mimeType = "image/jpeg";

      if (imageUrl.startsWith("data:")) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBuffer = Buffer.from(match[2], "base64");
        } else {
          return res.status(400).json({ error: "Неверный формат data URL" });
        }
      } else {
        const resp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 15000 });
        imageBuffer = Buffer.from(resp.data);
        mimeType = String(resp.headers["content-type"] || "image/jpeg");
      }

      const base64 = imageBuffer.toString("base64");
      const systemPrompt = `You are a top product photography specialist. Analyze the product image and suggest a single, vivid background description for a professional product photo. The description should be concise (3–5 phrases), in English, and suited for AI image generation. Avoid mentioning any text, labels, or watermarks. Only describe the background scene, lighting, and atmosphere. Example: "clean white seamless studio backdrop, soft diffused lighting, subtle shadows, minimalistic, professional e-commerce look". Return ONLY the background description — no extra commentary, no formatting.`;

      const response = await getOpenAI().chat.completions.create({
        model: "openai/gpt-5.4-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
              { type: "text", text: "Suggest a professional background for this product. Return only the background description, no other text." },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.8,
      });

      const suggestion = (response.choices[0]?.message?.content || "").trim();
      console.log(`[suggest-background] ✓ suggestion="${suggestion.substring(0, 80)}..."`);
      res.json({ suggestion });
    } catch (err: any) {
      const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
      const message = err.message || "Неизвестная ошибка";
      console.error(`[suggest-background] ✗ ERROR: ${message}${axiosDetail}`);
      res.status(500).json({ error: message + axiosDetail });
    }
  });

  // ===== ЗАМЕНА ФОНА КАРТОЧКИ ЧЕРЕЗ ИИ =====
  app.post("/api/edit-background", async (req: Request, res: Response) => {
    try {
      const { imageUrl, prompt, modelId } = req.body as { imageUrl: string; prompt: string; modelId?: string };
      if (!imageUrl || !prompt) {
        return res.status(400).json({ error: "imageUrl и prompt обязательны" });
      }

      const validModelId = modelId === "nano-banana-2" || modelId === "nano-banana-pro" ? modelId : "nano-banana-pro";
      console.log(`[edit-background] ▶ START model=${validModelId} prompt="${prompt.substring(0, 60)}..."`);

      // Проверяем звёзды для авторизованных пользователей
      const userId = req.session?.userId;
      const cost = 1; // 1 звезда за смену фона
      let user = null;
      if (userId) {
        user = await storage.getAppUserById(userId);
        if (!user) return res.status(401).json({ error: "Пользователь не найден" });
        if (user.starsBalance < cost) {
          return res.status(403).json({ error: "Недостаточно звёзд. Пополните баланс, купив пакет карточек." });
        }
      } else {
        return res.status(401).json({ error: "Смена фона доступна только авторизованным пользователям" });
      }

      if (!isTrustedImageUrl(imageUrl)) {
        return res.status(400).json({ error: "Недопустимый URL изображения" });
      }

      let imageBuffer: Buffer;
      let mimeType = "image/jpeg";

      if (imageUrl.startsWith("data:")) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBuffer = Buffer.from(match[2], "base64");
        } else {
          return res.status(400).json({ error: "Неверный формат data URL" });
        }
      } else {
        // Скачиваем по внешнему URL
        const resp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 15000 });
        imageBuffer = Buffer.from(resp.data);
        mimeType = String(resp.headers["content-type"] || "image/jpeg");
      }

      const fullPrompt = `Replace only the background of this product image. Keep the product itself exactly as is — preserve all its details, shape, lighting, and shadows. The new background should be: ${prompt}. Do not alter the product in any way. Output a clean product photo with the requested background only.`;

      const polzaModelId = POLZA_MODEL_MAP[validModelId];
      const imageResolution = modelToResolution(validModelId);
      console.log(`[edit-background] ▶ calling Polza.ai model=${polzaModelId} res=${imageResolution}`);

      const resultUrl = await callPolzaMedia({
        polzaModelId,
        prompt: fullPrompt,
        imageResolution,
        images: [{ buffer: imageBuffer, mimeType }],
      });

      const isTrialEdit = !user || (user.nano2Balance === 0 && user.proBalance === 0 && (user.trialNano2Used || user.trialProUsed || user.trialTryonUsed));
      const finalUrl = await processResultImage(resultUrl, isTrialEdit);
       const updatedUser = await storage.deductStars(userId, cost);
       if (!updatedUser) {
         return res.status(409).json({ error: "Не удалось списать звезду. Попробуйте ещё раз." });
       }
      console.log(`[edit-background] ✓ DONE trial=${isTrialEdit} url=${finalUrl.substring(0, 80)}...`);
      res.json({ url: finalUrl, status: "done", starsBalance: updatedUser?.starsBalance ?? 0 });
    } catch (err: any) {
      const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
      const message = err.message || "Неизвестная ошибка";
      console.error(`[edit-background] ✗ ERROR: ${message}${axiosDetail}`);
      res.status(500).json({ error: message + axiosDetail });
    }
  });

  // ===== ОПЕРАЦИИ РЕДАКТОРА И СПИСАНИЕ ЗВЁЗД =====
  app.post("/api/editor/deduct-stars", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ error: "Авторизуйтесь, чтобы использовать инструменты редактора" });
      const { amount, actionType } = req.body as { amount?: number; actionType?: string };
      const cost = Number(amount);
      if (!Number.isFinite(cost) || cost <= 0 || cost > 10 || !actionType) {
        return res.status(400).json({ error: "Некорректные параметры операции" });
      }
      const user = await storage.getAppUserById(userId);
      if (!user) return res.status(401).json({ error: "Пользователь не найден" });
      if (user.starsBalance < cost) {
        return res.status(403).json({ error: `Недостаточно звёзд. Нужно ${cost} ⭐. Пополните баланс.` });
      }
       const updated = await storage.deductStars(userId, cost);
       if (!updated) {
         return res.status(409).json({ error: "Не удалось списать звёзды. Попробуйте ещё раз." });
       }
      console.log(`[editor] ✓ deducted action=${actionType} cost=${cost} userId=${userId}`);
      return res.json({ starsBalance: updated?.starsBalance ?? 0 });
    } catch (err: any) {
      console.error("[editor] deduct-stars error:", err);
      return res.status(500).json({ error: "Не удалось списать звёзды" });
    }
  });

  // ===== AUTH =====

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function serializeAppUser(user: Awaited<ReturnType<typeof storage.getAppUserById>>) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nano2Balance: user.nano2Balance,
      proBalance: user.proBalance,
      starsBalance: user.starsBalance,
      nano2ExpiresAt: user.nano2Subscription.expiresAt.toISOString(),
      proExpiresAt: user.proSubscription.expiresAt.toISOString(),
      trialNano2Used: user.trialNano2Used,
      trialNano2Count: user.trialNano2Count,
      trialProUsed: user.trialProUsed,
      trialTryonUsed: user.trialTryonUsed,
    };
  }

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      if (!email?.trim() || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
      }
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed)) return res.status(400).json({ error: "Введите корректный email" });
      if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
      const existing = await storage.getAppUserByUsername(trimmed);
      if (existing) return res.status(409).json({ error: "Аккаунт с таким email уже существует" });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createAppUser(trimmed, passwordHash);
      await storage.trackUser(trimmed);
      req.session.userId = user.id;
      req.session.username = user.username;
      // Применяем ожидающие зачисления от администратора (аналогично входу)
      const pending = await storage.consumePendingCredits(trimmed);
      if (pending.nano2 > 0 || pending.pro > 0) {
        await storage.updateAppUserBalances(user.id, user.nano2Balance + pending.nano2, user.proBalance + pending.pro);
        user.nano2Balance += pending.nano2;
        user.proBalance += pending.pro;
      }
      res.json(serializeAppUser(user));
    } catch (err: any) {
      console.error("[auth/register] error:", err);
      res.status(500).json({ error: "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      if (!email?.trim() || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
      }
      const user = await storage.getAppUserByUsername(email.trim());
      if (!user) return res.status(401).json({ error: "Неверный email или пароль" });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Неверный email или пароль" });
      // Применяем ожидающие зачисления от администратора
      const pending = await storage.consumePendingCredits(user.username);
      if (pending.nano2 > 0 || pending.pro > 0) {
        await storage.updateAppUserBalances(user.id, user.nano2Balance + pending.nano2, user.proBalance + pending.pro);
        user.nano2Balance += pending.nano2;
        user.proBalance += pending.pro;
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json(serializeAppUser(user));
    } catch (err: any) {
      console.error("[auth/login] error:", err);
      res.status(500).json({ error: "Ошибка входа" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    const user = await storage.getAppUserById(userId);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    res.json(serializeAppUser(user));
  });

  // Примечание: клиентский эндпоинт для произвольной установки баланса был удалён —
  // это позволяло любому авторизованному пользователю начислить себе баланс напрямую.
  // Баланс теперь начисляется исключительно доверенными серверными путями:
  // подтверждённый платёж (см. /api/payment/verify → storage.creditConfirmedPayment)
  // и проверка dev-промокода (см. /api/promo/dev-cards → storage.grantDeveloperCredit).
  // Административное изменение баланса — через отдельные admin-маршруты (см. ниже).

  // Примечание: списание баланса/пробной попытки теперь происходит на сервере
  // атомарно в момент запуска генерации (см. storage.consumeEntitlement в
  // /api/generate, /api/generate-tryon), а не по отдельному клиентскому запросу.

  // ===== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ПОЛЬЗОВАТЕЛЯ =====

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email: string };
      const normalizedEmail = email?.trim().toLowerCase();
      const generic = { ok: true, message: "Если аккаунт с таким email существует, на него отправлена ссылка для восстановления пароля." };
      if (!normalizedEmail) return res.json(generic);
      const memStorage = storage as MemStorage;

      // Rate limiting: не чаще 1 раза в 5 минут на email (применяем до проверки существования аккаунта,
      // чтобы не было возможности перебирать адреса и не нагружать SMTP).
      if (!memStorage.canRequestPasswordReset(normalizedEmail)) {
        return res.status(429).json({ error: "Письмо уже отправлено. Попробуйте позже." });
      }
      memStorage.markPasswordResetRequested(normalizedEmail);

      const user = await storage.getAppUserByUsername(normalizedEmail);
      if (!user) return res.json(generic); // не раскрываем существование аккаунта

      const token = memStorage.createPasswordResetToken(user.email);
      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${encodeURIComponent(token)}`;

      // Отправляем письмо через SMTP Beget (noreply@kardomatik.ru)
      await sendPasswordResetEmail({ to: user.email, resetUrl });

      console.log(`[auth/forgot-password] Письмо отправлено (${user.email})`);
      res.json(generic);
    } catch (err: any) {
      console.error("[auth/forgot-password] error:", err);
      res.status(500).json({ error: "Ошибка запроса восстановления пароля" });
    }
  });

  // GET /api/auth/reset-password/validate?token=... — проверяет валидность ссылки
  // перед отображением формы нового пароля.
  app.get("/api/auth/reset-password/validate", (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      const memStorage = storage as MemStorage;
      const email = token ? memStorage.peekPasswordResetToken(token) : null;
      res.json({ valid: !!email });
    } catch (err: any) {
      console.error("[auth/reset-password/validate] error:", err);
      res.status(500).json({ error: "Ошибка проверки ссылки" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body as { token: string; password: string };
      if (!token || !password) return res.status(400).json({ error: "Токен и пароль обязательны" });
      if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
      const memStorage = storage as MemStorage;
      const email = memStorage.consumePasswordResetToken(token);
      if (!email) return res.status(400).json({ error: "Ссылка недействительна или устарела" });
      const passwordHash = await bcrypt.hash(password, 10);
      const ok = await storage.resetUserPassword(email, passwordHash);
      if (!ok) return res.status(404).json({ error: "Пользователь не найден" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[auth/reset-password] error:", err);
      res.status(500).json({ error: "Ошибка восстановления пароля" });
    }
  });

  // Периодическая очистка просроченных карточек (каждые 30 мин)
  setInterval(() => {
    storage.deleteExpiredGenerations().then((count) => {
      if (count > 0) console.log(`[cleanup] Удалено ${count} просроченных карточек`);
    }).catch(() => {});
  }, 30 * 60 * 1000);

  return httpServer;
}

// Собираем промпт для перегенерации с обновлённым текстом
function buildRegeneratePrompt(analysis: any, aspectRatio: string): string {
  const benefits = (analysis.benefits || []).join(" | ");
  return `Create a professional marketplace product card for ${aspectRatio} aspect ratio.

Product title (must appear on card): "${analysis.title}"
Description to highlight: "${analysis.description}"
Key benefits to feature with icons/badges: "${benefits}"
Call-to-action text: "${analysis.callToAction}"
${analysis.designStyle ? `Design style: ${analysis.designStyle}` : ""}

Requirements:
- All text overlays must be in Russian language
- Clean modern design with gradient or subtle background
- Highlight the product with professional lighting and shadows
- Include only neutral decorative elements; do not add, reproduce, or preserve any marketplace/platform logo, watermark, badge, brand mark, or platform-specific visual symbol
- Make the title prominent, benefits as bullet points or badges
- Add the call-to-action as a standout button or badge
- Preserve the original product photo as the central element`;
}
