---
name: Polza.ai API
description: Правильные эндпоинты, модели и формат запросов для Polza.ai image generation
---

# Polza.ai API — дуральные факты

## Эндпоинты
- Base URL: `https://polza.ai/api/v1`
- ✅ `POST /chat/completions` — для vision-анализа (LLM)
- ✅ `POST /media` — для генерации изображений (image-to-image)
- ✅ `GET /media/{id}` — поллинг асинхронных задач
- ✅ `GET /models` — список всех моделей
- ❌ `POST /images/edits` — НЕ СУЩЕСТВУЕТ (404)
- ⚠️ `POST /images/generations` — существует, но не принимает входные изображения

## Модели для генерации изображений (через /media)
- `google/gemini-3.1-flash-image-preview` = "Nano Banana 2" (input: image+text, 1K res, 4.8 руб)
- `google/gemini-3-pro-image-preview` = "Nano Banana Pro" (input: image+text, 1K-4K, 13.5 руб)
- `openai/gpt-5.4-image-2` = OpenAI GPT-5.4 Image 2 (input: image+text+file, 4 руб/1K)

## Модели для анализа (через /chat/completions, vision)
- `openai/gpt-5.4-mini` — cheapest good quality OpenAI vision (69.52/417 руб/1M)
- `openai/gpt-5.4-nano` — cheapest of all (18.54/115.87 руб/1M)
- `google/gemini-3.1-flash-lite` — cheapest Google vision (23.17/139.05 руб/1M)
- НЕТ `gpt-4o` под этим именем — используй `openai/gpt-5.4-mini` как замену

## Формат запроса POST /media
```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "input": {
    "prompt": "...",
    "aspect_ratio": "1:1",
    "image_resolution": "1K",
    "images": [
      { "type": "base64", "data": "base64string_without_prefix", "media_type": "image/jpeg" }
    ]
  }
}
```
Поддерживаемые aspect_ratio: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, auto
Поддерживаемые image_resolution: 1K, 2K, 4K
Максимум images: 14 штук

## Формат ответа POST /media
- Синхронный: `{ "status": "completed", "data": { "url": "https://..." } }`
- Асинхронный: `{ "id": "gen_...", "status": "pending", ... }` → поллить `GET /media/{id}`

**Why:** Polza.ai — российский прокси для AI-моделей. Они реализовали только chat/completions и собственный /media эндпоинт. OpenAI /images/edits и /images/generations (с input image) не поддерживаются.

**How to apply:** Всегда использовать `fetch("https://polza.ai/api/v1/media", ...)` для image generation, а не openai.images.edit(). Для LLM-анализа использовать openai SDK с baseURL polza.ai, модель "openai/gpt-5.4-mini".
