---
name: Admin panel user model
description: How the admin Users tab sources data and how admin actions credit/authenticate — relevant before changing admin endpoints or the users table.
---

The admin Users tab is populated from a legacy `serverUsers` map (created via `trackUser`,
originally keyed only by username/email, no `id`), joined at read-time with the real
`appUsers` accounts (which do have `id`, balances, `isDeveloper`) by matching
username/email case-insensitively.

**Why:** `serverUsers` predates the email/password account system added later; it was kept
for generation-count tracking and pending-credit bookkeeping, not as the source of truth for
identity. AppUser is the source of truth for identity/balance.

**How to apply:** When adding fields to the admin users table (e.g. account `id`), join from
`appUsers` at read time rather than adding real identity fields to `serverUsers`. When adding
admin actions that mutate balance, prefer crediting the `AppUser` directly (immediate effect)
over the `pendingNano2/pendingPro` mechanism — pending credits are only consumed at login and
exist for a case where no matching AppUser exists yet; don't reuse them for actions that are
supposed to apply immediately.

Admin auth is a single shared dev-code header (`x-dev-code`), not per-admin accounts — there's
no real "actor identity" to log beyond the code itself. When logging admin actions, a masked
prefix of the code is an acceptable stand-in for "who performed it".

Administrative star grants use the real `app_users` account ID, update `stars_balance`, and write
an `admin_added` transaction in the same database transaction; legacy users without an account ID
cannot receive immediate star grants.

**Why:** The admin Users list includes legacy tracking records, but only PostgreSQL AppUser rows
have an authoritative star balance and can be linked to an auditable grant.

**How to apply:** Keep star-grant UI actions hidden when `ServerUser.id` is absent, and validate
grant amounts server-side against the fixed allowlist.
