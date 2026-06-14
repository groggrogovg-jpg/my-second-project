# КардоМатик — ИИ-генератор карточек товаров

## Обзор

Приложение для автоматической генерации профессиональных карточек товаров с помощью ИИ. Пользователь загружает фото товара, добавляет примечания и выбирает модель — GPT-5.4 Mini анализирует продукт, затем Nano Banana (Polza.ai) генерирует готовую карточку.

## Технологический стек

- **Фронтенд**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Бэкенд**: Node.js + Express
- **Хранилище**: In-memory (MemStorage, сбрасывается при рестарте)
- **ИИ**: Polza.ai (OpenAI-совместимый прокси) — анализ через `openai/gpt-5.4-mini`, генерация через `google/gemini-3.1-flash-image-preview` и `google/gemini-3-pro-image-preview`
- **Оплата**: ЮMoney (quickpay форма, VITE_YOOMONEY_WALLET)

## Архитектура

### Три вкладки
- **Карточка** — генерация карточки товара для маркетплейса
- **Фото** — виртуальная примерка одежды (фото человека + фото одежды)
- **Видео** — кинематографичный кадр товара (статичное изображение в стиле рекламы)

### Процесс генерации (карточка)
1. Пользователь загружает фото + добавляет примечания + выбирает настройки
2. Сервер принимает файл через multer
3. `openai/gpt-5.4-mini` анализирует изображение через `chat.completions` (vision) и создаёт маркетинговый пакет + промпт
4. `POST /api/v1/media` на Polza.ai с изображением (base64) и промптом
5. Если ответ async (`status: "pending"`) — поллим `GET /api/v1/media/{id}` каждые 3 сек
6. Готовая карточка показывается на весь экран (без оригинала)

### Polza.ai API Details
- **Base URL**: `https://polza.ai/api/v1`
- **Анализ**: `POST /chat/completions` с моделью `openai/gpt-5.4-mini` (vision: image_url в messages)
- **Генерация**: `POST /media` — единственный эндпоинт для картинок и видео
  - `/images/edits` НЕ поддерживается (404)
  - `/images/generations` поддерживается, но без передачи входного изображения
- **Формат запроса к /media**:
  ```json
  { "model": "google/gemini-3.1-flash-image-preview",
    "input": { "prompt": "...", "aspect_ratio": "1:1", "image_resolution": "1K",
               "images": [{ "type": "base64", "data": "base64string", "media_type": "image/jpeg" }] } }
  ```
- **Ответ**: `{ "id": "...", "status": "pending"|"completed", "data": { "url": "..." } }`
  - Если `status: "pending"` → поллить `GET /media/{id}`

### Маппинг пользовательских моделей → Polza.ai
- `nano-banana-2` → `google/gemini-3.1-flash-image-preview` (1K, 4.8 руб)
- `nano-banana-pro` → `google/gemini-3-pro-image-preview` (2K, 13.5 руб)

### Модели и цены (в звёздах)
- `nano-banana-2` — 3 звезды, 1K качество, Эконом
- `nano-banana-pro` — 7 звёзд, 2K качество, Премиум
- Видео (кадр) — 5 звёзд
- Примерка — 5 звёзд

### Соотношения сторон
- 1:1 — Wildberries, Ozon, AliExpress
- 3:4 — Wildberries, Ozon
- 4:5 — Wildberries (оптимально)
- 4:3 — Яндекс Маркет, Авито
- 9:16 — Stories, TikTok Shop

### Система звёзд
- Хранится в localStorage (ключ `kardo_stars`)
- Начальный баланс: 10 звёзд
- Списываются при успешной генерации (не при запуске)

### API Endpoints
- `POST /api/generate` — загрузка изображения, запуск генерации карточки (поля: image, model, aspectRatio, notes)
- `POST /api/generate-video` — загрузка изображения, запуск видеогенерации (поля: image, duration, prompt)
- `POST /api/generate-tryon` — загрузка двух фото, запуск примерки (поля: person, garment)
- `GET /api/generation/:id` — проверка статуса + получение результата
- `GET /api/generations` — история всех генераций
- `GET /api/proxy-image?url=...` — CORS-прокси для скачивания результатов

### Статусы генерации
`pending` → `analyzing` → `uploading` → `generating` → `done` | `error`

## Структура файлов

```
client/src/
  pages/
    home.tsx          — главная страница (вкладки: карточка/фото/видео)
    pricing.tsx       — страница тарифов (поштучно/пакеты/подписка)
  components/
    generation-card.tsx — карточка в истории
    result-view.tsx   — результат (карточка/фото/видео)
shared/
  schema.ts           — типы, MODELS, ASPECT_RATIOS, PRICING_PLANS, SUBSCRIPTION_PLANS
server/
  routes.ts           — API + OpenAI GPT-4o + kie.ai (Nano Banana, Kling v2.1)
  storage.ts          — in-memory хранилище
```

## Переменные окружения

- `OPENAI_API_KEY` — ключ OpenAI для GPT-4o
- `KIE_AI_API_KEY` — ключ kie.ai для Nano Banana + Kling
- `SESSION_SECRET` — секрет сессии
- `VITE_YOOMONEY_WALLET` — номер кошелька ЮMoney (для активации оплаты на странице /pricing)
- `YOOMONEY_ACCESS_TOKEN` — токен для верификации платежей
- `YOOMONEY_NOTIFICATION_SECRET` — секрет уведомлений ЮMoney

## Запуск

```bash
npm run dev
```

Приложение работает на порту 5000. Маршруты: `/` (главная), `/pricing` (тарифы).
