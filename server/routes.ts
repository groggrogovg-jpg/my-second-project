import express from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, MemStorage } from "./storage";
import multer from "multer";
import OpenAI from "openai";
import axios from "axios";
import path from "path";
import crypto from "crypto";
import { URL } from "url";
import bcrypt from "bcrypt";

const YM_NOTIFY_SECRET = process.env.YOOMONEY_NOTIFICATION_SECRET || "";
const DEV_PROMO_CODE = process.env.DEV_PROMO_CODE || "DEV100";

function adminOnly(req: Request, res: Response, next: Function) {
  const devCode = (req.headers["x-dev-code"] as string) || "";
  if (!devCode) return res.status(403).json({ error: "Доступ запрещён" });
  const memStorage = storage as MemStorage;
  if (devCode.trim() === DEV_PROMO_CODE) return next();
  if (memStorage.adminOverrideCode && devCode.trim() === memStorage.adminOverrideCode) return next();
  return res.status(403).json({ error: "Доступ запрещён" });
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
  "nano2-5":   { price: 199,  cardsIncluded: 5,   modelType: "nano2", name: "Nano Banana 2 — 5 карточек" },
  "nano2-10":  { price: 379,  cardsIncluded: 10,  modelType: "nano2", name: "Nano Banana 2 — 10 карточек" },
  "nano2-50":  { price: 1790, cardsIncluded: 50,  modelType: "nano2", name: "Nano Banana 2 — 50 карточек" },
  "nano2-100": { price: 3490, cardsIncluded: 100, modelType: "nano2", name: "Nano Banana 2 — 100 карточек" },
  "pro-5":     { price: 299,  cardsIncluded: 5,   modelType: "pro",   name: "Nano Banana Pro — 5 карточек" },
  "pro-10":    { price: 579,  cardsIncluded: 10,  modelType: "pro",   name: "Nano Banana Pro — 10 карточек" },
  "pro-50":    { price: 2790, cardsIncluded: 50,  modelType: "pro",   name: "Nano Banana Pro — 50 карточек" },
  "pro-100":   { price: 5490, cardsIncluded: 100, modelType: "pro",   name: "Nano Banana Pro — 100 карточек" },
};

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
    ? `"prompt": "Детальный промпт на английском для нейросети (описание того, как оформить фото товара в профессиональную карточку для маркетплейса, включая: стиль фона, цветовую схему, эффекты освещения, тени, декоративные элементы. ВАЖНО: без каких-либо текстовых надписей, заголовков и плашек с текстом — только товар и фон)"`
    : `"prompt": "Детальный промпт на английском для нейросети (описание того, как изменить и оформить фото товара в профессиональную карточку для маркетплейса, включая: стиль фона, цветовую схему, расположение текстовых блоков, инфографику, логотип место, эффекты освещения, тени. Текст в карточке должен быть на РУССКОМ языке)"`;

  const systemPrompt = `Ты — топ-маркетолог мирового уровня и эксперт по созданию карточек товаров для маркетплейсов. 
Твоя задача: проанализировать фото товара и создать мощное продающее описание, а также написать детальный промпт для нейросети, которая создаст профессиональную карточку товара.

Ответь ТОЛЬКО в формате JSON без markdown, строго следуя этой структуре:
{
  "title": "Короткое продающее название (до 60 символов)",
  "description": "Продающее описание товара (2-3 предложения, подчёркивающие ценность)",
  "benefits": ["Преимущество 1", "Преимущество 2", "Преимущество 3", "Преимущество 4"],
  "callToAction": "Призыв к действию (до 30 символов)",
  "designStyle": "Описание стиля дизайна карточки",
  ${promptField}
}`;

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
            text: `Проанализируй этот товар и создай продающую карточку. Верни только JSON без пояснений.${notes ? `\n\nДополнительная информация от продавца: ${notes}` : ""}`,
          },
        ],
      },
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
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
- Create a professional marketplace product card based on the provided photo
- Use modern clean design with gradient or white background
- Beautiful product showcase with perfect lighting and shadows
- NO text, NO text overlays, NO captions, NO labels, NO badges with text anywhere in the image
- Only the product and a clean, professional background`
    : `${prompt}

Important requirements:
- Create a professional marketplace product card based on the provided photo
- Add Russian text overlays highlighting product benefits
- Use modern clean design with gradient or white background
- Include decorative elements: badges, stars, quality icons
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

      console.log(`[generate] ▶ START file=${filename} size=${imageBuffer.length}b model=${model} ratio=${aspectRatio} noText=${noText} notes="${notes.substring(0, 50)}${notes.length > 50 ? "..." : ""}"`);

      const generation = await storage.createGeneration({
        originalImageUrl: imageDataUrl,
        status: "analyzing",
        model,
        aspectRatio,
        notes: notes || null,
      });

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
          await storage.updateGeneration(generation.id, { status: "done", resultImageUrl: resultUrl });
          if (username) storage.incrementUserGenerations(username).catch(() => {});
          console.log(`[generate] ✓ Polza.ai done id=${generation.id} url=${resultUrl.substring(0, 80)}...`);

        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          const message = err.message || "Неизвестная ошибка";
          console.error(`[generate] ✗ BACKGROUND ERROR id=${generation.id}: ${message}${axiosDetail}`);
          await storage.updateGeneration(generation.id, { status: "error", errorMessage: message + axiosDetail });
          storage.addErrorLog({ username, model, errorMessage: message + axiosDetail, generationType: "card" }).catch(() => {});
        }
      })();

    } catch (err: any) {
      console.error(`[generate] ✗ FATAL ERROR: ${err.message}`);
      res.status(500).json({ error: err.message || "Ошибка сервера" });
    }
  });

  app.post("/api/generate-video", upload.single("image"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Изображение не загружено" });

      const imageBuffer = req.file.buffer;
      const filename = req.file.originalname || "product.jpg";
      const duration = parseInt(req.body?.duration as string) || 5;
      const prompt = (req.body?.prompt as string) || "";

      console.log(`[generate-video] ▶ START file=${filename} duration=${duration}s`);

      const generation = await storage.createGeneration({
        originalImageUrl: `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`,
        status: "generating",
        model: "nano-banana-2",
        aspectRatio: "9:16",
        generationType: "video",
      } as any);

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
      const files = req.files as Record<string, Express.Multer.File[]>;
      const personFile = files?.person?.[0];
      const garmentFiles = files?.garment || [];

      if (!personFile || garmentFiles.length === 0) {
        return res.status(400).json({ error: "Нужны фото модели и хотя бы 1 элемент одежды" });
      }

      console.log(`[generate-tryon] ▶ START person=${personFile.originalname} garments=${garmentFiles.length}`);

      const generation = await storage.createGeneration({
        originalImageUrl: `data:${personFile.mimetype};base64,${personFile.buffer.toString("base64")}`,
        status: "generating",
        model: "nano-banana-2",
        aspectRatio: "9:16",
        generationType: "tryon",
      } as any);

      res.json({ id: generation.id, status: "generating" });

      (async () => {
        try {
          console.log(`[generate-tryon] ▶ Calling Polza.ai for tryon id=${generation.id}`);
          const resultUrl = await generateTryonWithPolza(
            personFile.buffer, personFile.originalname, personFile.mimetype,
            garmentFiles,
          );
          await storage.updateGeneration(generation.id, { status: "done", resultImageUrl: resultUrl });
          console.log(`[generate-tryon] ✓ Polza.ai done id=${generation.id} url=${resultUrl.substring(0, 80)}...`);
        } catch (err: any) {
          const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
          console.error(`[generate-tryon] ✗ ERROR id=${generation.id}: ${err.message}${axiosDetail}`);
          await storage.updateGeneration(generation.id, { status: "error", errorMessage: err.message + axiosDetail });
          storage.addErrorLog({ username: (req.body?.username as string) || "", model: "nano-banana-2", errorMessage: err.message + axiosDetail, generationType: "tryon" }).catch(() => {});
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
      const generationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const generation = await storage.getGeneration(generationId);
      if (!generation) {
        console.log(`[poll] ✗ id=${req.params.id} NOT FOUND`);
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
    try {
      const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      const contentType = response.headers["content-type"] || "image/png";
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(response.data));
    } catch (err: any) {
      res.status(502).json({ error: "Failed to fetch image" });
    }
  });

  app.get("/api/generations", async (_req: Request, res: Response) => {
    try {
      const gens = await storage.listGenerations();
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
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ error: "Код не указан" });
    if (code.trim() !== DEV_PROMO_CODE) {
      return res.status(403).json({ error: "Неверный код разработчика" });
    }
    console.log(`[promo/dev] ✓ developer code activated`);
    return res.json({ nano2: 100, pro: 100, isDeveloper: true, message: "Баланс пополнен: +100 Nano2, +100 Pro" });
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
    const { username } = req.params;
    const { nano2Delta, proDelta } = req.body as { nano2Delta?: number; proDelta?: number };
    if (nano2Delta === undefined && proDelta === undefined) {
      return res.status(400).json({ error: "nano2Delta или proDelta обязательны" });
    }
    await storage.addPendingCredits(username, nano2Delta || 0, proDelta || 0);
    console.log(`[admin] ✓ pending credits added for ${username}: nano2=${nano2Delta || 0} pro=${proDelta || 0}`);
    return res.json({ ok: true });
  });

  app.post("/api/admin/users/:username/reset-balance", adminOnly, async (req: Request, res: Response) => {
    const { username } = req.params;
    await storage.addPendingCredits(username, -99999, -99999);
    console.log(`[admin] balance reset pending for ${username}`);
    return res.json({ ok: true });
  });

  app.get("/api/admin/payments", adminOnly, async (_req: Request, res: Response) => {
    const payments = await storage.listPayments();
    return res.json(payments);
  });

  app.get("/api/admin/logs", adminOnly, async (_req: Request, res: Response) => {
    const logs = await storage.getErrorLogs();
    return res.json(logs);
  });

  app.post("/api/admin/forgot-code", async (_req: Request, res: Response) => {
    const memStorage = storage as MemStorage;
    const token = memStorage.createAdminResetToken();
    console.log(`\n[admin/forgot-code] Одноразовый токен для сброса кода:`);
    console.log(`[admin/forgot-code] TOKEN: ${token}`);
    console.log(`[admin/forgot-code] Действителен 15 минут\n`);
    return res.json({ ok: true, token });
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
        console.log(`[payment/create] ▶ START packageId=${packageId}`);
        const pkg = PACKAGE_DATA[packageId];
        if (!pkg) {
          console.log(`[payment/create] ✗ package NOT FOUND packageId=${packageId}`);
          return res.status(400).json({ error: "Пакет не найден" });
        }
        console.log(`[payment/create] ✓ package found: ${pkg.name} price=${pkg.price} cards=${pkg.cardsIncluded} model=${pkg.modelType}`);

        const amount = getTestPrice(pkg.price);
        const label = `pkg-${packageId}-${Date.now()}`;
        const comment = `КардоМатик: ${pkg.name}`;
        const username = (req.body?.username as string) || (req.session as any).username || "";
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

        await storage.recordPayment({ label, starsToAdd: 0, cardsIncluded: pkg.cardsIncluded, modelType: pkg.modelType, operationId: "", amount: String(amount), username });
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

      await storage.recordPayment({ label, starsToAdd: plan.starsIncluded, cardsIncluded: 0, modelType: "", operationId: "", amount: String(amount) });
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

      // Save operation_id and confirm payment
      await storage.updatePaymentOperationId(label, operation_id || "");
      const confirmed = await storage.confirmPayment(label);
      if (confirmed) {
        console.log(`[payment/webhook] ✓ payment confirmed label=${label} operationId=${operation_id} amount=${amount}`);
      } else {
        console.warn(`[payment/webhook] ⚠ payment label not found in storage: ${label}`);
      }

      res.status(200).send("ok");
    } catch (err: any) {
      console.error(`[payment/webhook] ✗ ERROR: ${err.message}`);
      res.status(500).send("error");
    }
  });

  // Проверка статуса платежа по label — клиент использует этот эндпоинт вместо URL-параметров
  app.get("/api/payment/verify", async (req: Request, res: Response) => {
    const label = req.query.label as string;
    if (!label) return res.status(400).json({ error: "label required" });

    const payment = await storage.getPaymentByLabel(label);
    if (!payment) {
      console.log(`[payment/verify] ✗ label not found: ${label}`);
      return res.json({ paid: false, found: false });
    }

    if (!payment.confirmed) {
      console.log(`[payment/verify] ⏳ label=${label} not yet confirmed`);
      return res.json({ paid: false, found: true });
    }

    console.log(`[payment/verify] ✓ label=${label} confirmed cards=${payment.cardsIncluded} model=${payment.modelType} stars=${payment.starsToAdd}`);
    return res.json({
      paid: true,
      found: true,
      cards: payment.cardsIncluded,
      model: payment.modelType,
      stars: payment.starsToAdd,
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
    const { chatId } = req.params;
    const messages = await storage.getSupportMessages(chatId);
    res.json(messages);
  });

  app.post("/api/support/chats/:chatId/reply", adminOnly, async (req: Request, res: Response) => {
    const { chatId } = req.params;
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
    const { chatId } = req.params;
    await storage.markMessagesRead(chatId);
    res.json({ ok: true });
  });

  app.post("/api/support/chats/:chatId/status", adminOnly, async (req: Request, res: Response) => {
    const { chatId } = req.params;
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
            mimeType = resp.headers["content-type"] || "image/jpeg";
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

          await storage.updateGeneration(generationId, {
            status: "done",
            resultImageUrl: resultUrl,
          });
          console.log(`[regenerate] ✓ DONE id=${generationId} url=${resultUrl.substring(0, 80)}...`);
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
        mimeType = resp.headers["content-type"] || "image/jpeg";
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
        mimeType = resp.headers["content-type"] || "image/jpeg";
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

      console.log(`[edit-background] ✓ DONE url=${resultUrl.substring(0, 80)}...`);
      res.json({ url: resultUrl, status: "done" });
    } catch (err: any) {
      const axiosDetail = err?.response?.data ? ` [${JSON.stringify(err.response.data)}]` : "";
      const message = err.message || "Неизвестная ошибка";
      console.error(`[edit-background] ✗ ERROR: ${message}${axiosDetail}`);
      res.status(500).json({ error: message + axiosDetail });
    }
  });

  // ===== AUTH =====

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as { username: string; password: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "Логин и пароль обязательны" });
      }
      const trimmed = username.trim();
      if (trimmed.length < 2) return res.status(400).json({ error: "Логин минимум 2 символа" });
      if (password.length < 6) return res.status(400).json({ error: "Пароль минимум 6 символов" });
      const existing = await storage.getAppUserByUsername(trimmed);
      if (existing) return res.status(409).json({ error: "Пользователь с таким логином уже существует" });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createAppUser(trimmed, passwordHash);
      await storage.trackUser(trimmed);
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ id: user.id, username: user.username, nano2Balance: user.nano2Balance, proBalance: user.proBalance, trialCount: user.trialCount });
    } catch (err: any) {
      console.error("[auth/register] error:", err);
      res.status(500).json({ error: "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as { username: string; password: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "Логин и пароль обязательны" });
      }
      const user = await storage.getAppUserByUsername(username.trim());
      if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Неверный логин или пароль" });
      // Применяем ожидающие зачисления от администратора
      const pending = await storage.consumePendingCredits(user.username);
      if (pending.nano2 > 0 || pending.pro > 0) {
        await storage.updateAppUserBalances(user.id, user.nano2Balance + pending.nano2, user.proBalance + pending.pro);
        user.nano2Balance += pending.nano2;
        user.proBalance += pending.pro;
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      res.json({ id: user.id, username: user.username, nano2Balance: user.nano2Balance, proBalance: user.proBalance, trialCount: user.trialCount });
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
    res.json({ id: user.id, username: user.username, nano2Balance: user.nano2Balance, proBalance: user.proBalance, trialCount: user.trialCount });
  });

  app.post("/api/auth/balance", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Не авторизован" });
    const { nano2Balance, proBalance } = req.body as { nano2Balance: number; proBalance: number };
    await storage.updateAppUserBalances(userId, nano2Balance, proBalance);
    res.json({ ok: true });
  });

  app.post("/api/auth/trial", async (req: Request, res: Response) => {
    const userId = req.session?.userId;
    if (userId) {
      await storage.incrementAppUserTrial(userId);
      const user = await storage.getAppUserById(userId);
      return res.json({ trialCount: user?.trialCount ?? 0 });
    }
    res.json({ ok: true });
  });

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
- Include decorative elements matching the marketplace style
- Make the title prominent, benefits as bullet points or badges
- Add the call-to-action as a standout button or badge
- Preserve the original product photo as the central element`;
}
