---
name: YooMoney confirmation fallback
description: Durable payment confirmation behavior when YooMoney notifications are delayed or missing
---

The payment return flow must verify the YooMoney operation server-to-server by label and exact amount when the notification webhook has not confirmed it. Client URL parameters are never sufficient evidence for crediting a balance.

**Why:** Production payment logs showed successful order creation followed by repeated unconfirmed polling with no webhook delivery.

**How to apply:** Keep `YOOMONEY_ACCESS_TOKEN` configured in the shared/production secrets and treat a missing token or failed history lookup as an unconfirmed payment, never as a successful payment.

Standalone star purchases use the same YooMoney webhook/history verification and atomic crediting path as card packages; their label encodes the star package and owner so pending payments can be recovered after a restart.

**Why:** Separate star purchases must remain subject to the same anti-forgery and idempotency guarantees as existing card payments.

**How to apply:** When adding another paid balance type, reuse the payment record, webhook, verification, and transactional crediting flow rather than trusting return URL parameters or creating a parallel confirmation path.