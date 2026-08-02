---
name: Email stored in the username field
description: User accounts are identified by email, but internally the field is still called `username`
---

User accounts are now email-only (registration/login take `email`, not a separate username), but the underlying `AppUser.username` field was **kept** and is simply populated with the lowercased email value, rather than renaming the field throughout the codebase.

**Why:** `username` is used as the join key across admin routes, payment records, usage tracking, and support chat. Renaming it everywhere had a large blast radius for no functional benefit — the UI/API contract already treats the identifier as an email (validated with a regex, unique, lowercased).

**How to apply:** when adding new features that key off the user identifier, use `user.username` (it equals `user.email`) unless you specifically need the `email` field for display; both exist on `AppUser` and are kept in sync at creation time.

Payment confirmation emails use the registered `AppUser.email` and are sent only after the payment's atomic credit succeeds; missing SMTP or delivery errors must never roll back or block the credit.

**Why:** Payment fulfillment is the source of truth for the customer, while email delivery is an external side effect that can fail independently.

**How to apply:** Keep confirmation-email calls after `creditConfirmedPayment` returns a user, and do not send again when a repeated webhook/verification sees an already-credited payment.
