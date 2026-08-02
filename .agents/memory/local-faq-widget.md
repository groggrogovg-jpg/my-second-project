---
name: Local FAQ widget
description: Durable behavior and maintenance rules for the client-side FAQ assistant
---

The FAQ assistant is intentionally client-only and deterministic: it searches the curated Russian FAQ entries by normalized keywords and offers Telegram support when no answer matches.

**Why:** The requested support assistant must not use OpenAI or any other AI service, and common questions should work without network requests or server availability.

**How to apply:** Add or edit entries in the FAQ data module, keep answers aligned with the current product behavior, and preserve the fallback link to the existing Telegram support bot.