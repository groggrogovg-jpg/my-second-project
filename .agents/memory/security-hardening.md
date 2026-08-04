---
name: Security hardening
description: Durable security constraints for sessions, auth endpoints, image suggestions, and SPA fallbacks
---

Сессионная cookie должна быть `secure`, `httpOnly`, `sameSite: "strict"` при доверенном reverse proxy; после успешной регистрации или входа ID сессии нужно ротировать через `req.session.regenerate`.

**Почему:** приложение работает за HTTPS reverse proxy, а повторное использование входной сессии создаёт риск session fixation; `rolling` не нужен и приводит к лишней ротации/обновлению cookie.

**Как применять:** новые auth-пути должны использовать серверную валидацию типов и rate limiting; неизвестные `/api`, `/assets` и dotfile URL должны отсеиваться до SPA fallback.

Для подсказки фона внешний URL разрешается только по строгому `http/https` формату и SSRF allowlist. Trial data-URL нельзя принимать напрямую от клиента в JSON, но их байты можно отправлять как multipart-файл, потому что trial-карточки намеренно хранятся локально как data-URL.

**Почему:** запрет `data:` закрывает аудитный вектор и не ломает текущий trial editor.

**Как применять:** при изменении image editor сохранять разделение между multipart bytes для локальных/trial изображений и JSON URL для доверенных удалённых изображений.