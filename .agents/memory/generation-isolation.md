---
name: Generation access model
description: How product-card/tryon generations are scoped to users and what auth is required to create them
---

Generation (card/video/try-on) requires an authenticated session; there is no anonymous/guest generation path.

**Why:** the product originally allowed anonymous generation with a shared client-side trial counter — an abuse vector and unreliable accounting. Replaced with an account-required model: one free trial per feature, tracked server-side.

**How to apply:** any new generation-triggering endpoint or entry point must check authentication server-side, not just gate the UI — endpoints are directly callable. Trial/balance consumption must also be enforced server-side (atomically, before starting work, with refund on failure) — a client-trusted "mark trial used" call after the fact is bypassable. Same principle applies to any balance-crediting endpoint: never trust client-supplied balance values: credit only from a server-verified event (confirmed payment, validated promo code), applied idempotently.
