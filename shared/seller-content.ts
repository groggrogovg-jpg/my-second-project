import { normalizeSellerNotes } from "./schema";

export function buildSellerAnalysisRule(notes = "", noText = false): string {
  const sellerText = normalizeSellerNotes(notes);
  if (!sellerText || noText) return "";

  return `
ОБЯЗАТЕЛЬНОЕ ПРАВИЛО: продавец дал бриф для карточки: ${JSON.stringify(sellerText)}
Используй смысл и факты из этого брифа как приоритетный источник. Не копируй весь текст одним абзацем: преврати его в убедительный короткий заголовок, 3–5 лаконичных выгод и при необходимости призыв к действию. Можно сокращать и переформулировать текст для сильной визуальной иерархии, но нельзя добавлять свойства, цифры или обещания, которых нет в брифе или нельзя уверенно подтвердить по фотографии.
`;
}

export function buildSellerAnalysisRequest(notes = ""): string {
  const sellerText = normalizeSellerNotes(notes);
  return `Проанализируй этот товар по заданному алгоритму и создай готовую продающую карточку маркетплейса. Верни только JSON без пояснений.${sellerText ? `\n\nБриф продавца: ${JSON.stringify(sellerText)}. Используй его факты и смысл, но переработай в короткие продающие текстовые блоки; не вставляй весь бриф на изображение одним абзацем и не придумывай неподтверждённые свойства.` : ""}`;
}

export function buildFinalCardPrompt(prompt: string, sellerNotes = "", noText = false): string {
  const exactSellerText = normalizeSellerNotes(sellerNotes);
  if (noText) {
    return `${prompt}

Important requirements:
 - Create a clean professional product card based on the provided photo
- Use modern clean design with gradient or white background
- Beautiful product showcase with perfect lighting and shadows
- NO text, NO text overlays, NO captions, NO labels, NO badges with text anywhere in the image
- Only the product and a clean, professional background`;
  }

  if (exactSellerText) {
    return `${prompt}

Seller brief and mandatory marketplace-card requirements:
- Treat this Russian seller brief as the primary source of product facts: ${JSON.stringify(exactSellerText)}
- Create a complete, visually striking, sales-focused marketplace product card — not a plain photo with the brief pasted on it
- Transform the brief into a concise Russian headline and 3–5 short benefit callouts with clear visual hierarchy
- You may shorten and rewrite for readability, but preserve the original meaning and never invent unsupported properties, numbers, certifications, or promises
- Every visible claim must be traceable to the seller brief or clearly visible in the product photo; do not add decorative slogans such as "premium", "best seller", collection names, or quality claims
- Treat only directly observable appearance and construction as visible facts; never infer weight, comfort, durability, material composition, weather resistance, or performance unless the seller brief states it
- Keep each benefit callout to one short phrase only; do not add smaller duplicate descriptions, filler copy, or English footer text
- Keep the product prominent; use professional composition, readable typography, lighting, shadows, background accents, and neutral infographic elements
- Never add marketplace/platform logos, watermarks, or platform-specific symbols
- All visible text must be in Russian`;
  }

  return `${prompt}

Important requirements:
- Create a professional marketplace product card based on the provided photo
- Add Russian text overlays highlighting product benefits
- Use modern clean design with gradient or white background
 - Include only neutral decorative elements; never add marketplace/platform logos, watermarks, or platform-specific symbols
- Make it visually striking and sales-focused
- All text overlays must be in Russian language`;
}