---
name: Static asset ordering
description: Ordering rules for production SPA asset serving and 404 guards
---

Проверки неизвестных asset-путей должны выполняться после `express.static`. Иначе guard на `/assets` перехватывает существующие JS/CSS-файлы и production SPA загружается с белым экраном.

**Почему:** опубликованный HTML может возвращаться с кодом 200, скрывая проблему, пока браузер не запросит главный hashed asset и не получит 404.

**Как применять:** при диагностике белого экрана сначала проверить HTML и каждый `<script src>`/stylesheet напрямую; после изменения порядка middleware перепроверить asset status в production-сборке.