---
name: Telegram support
description: Durable rules for the Telegram support inbox and webhook deployment
---

Telegram support must use the public production URL for `setWebhook`; the published application must contain both the webhook endpoint and the PostgreSQL support schema before Telegram delivery is considered live.

**Why:** Telegram cannot reach the development URL reliably, and production schema/runtime are separate from the development workflow.

**How to apply:** Keep the bot token in Replit Secrets, keep the production webhook URL in a non-secret environment variable, publish after code or schema changes, and use Telegram `update_id` as the idempotency key when storing inbound messages.