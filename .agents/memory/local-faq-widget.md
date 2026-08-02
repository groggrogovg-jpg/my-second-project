---
name: Local FAQ widget
description: Durable behavior and maintenance rules for the client-side FAQ assistant
---

The FAQ assistant is intentionally client-only and deterministic: it searches the curated Russian FAQ entries by normalized keywords and offers Telegram support when no answer matches.

**Why:** The requested support assistant must not use OpenAI or any other AI service, and common questions should work without network requests or server availability.

**How to apply:** The widget parses the same-origin `/faq?faq-source=1` page with `DOMParser`, caches entries in `localStorage` for one hour, and falls back to the bundled FAQ data on failure. FAQ sections are hidden with CSS only, so their question/answer elements remain in the source DOM for parsing. Keep the Telegram fallback link intact.