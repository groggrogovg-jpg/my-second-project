---
name: PostgreSQL storage migration
description: AppUser accounts and payments moved from MemStorage to PostgreSQL; tables, connection, and atomicity rules.
---

## Rule
AppUser accounts and PaymentRecords now live in PostgreSQL (`app_users` + `payments` tables).  
`server/db.ts` holds the Pool and `initDb()` which runs `CREATE TABLE IF NOT EXISTS` on startup.  
`server/storage.ts` MemStorage still owns: generations, serverUsers, supportChats, errorLogs (in-memory is acceptable for these).

## Why
MemStorage was wiping all user accounts and balances on every process restart. Production autoscale restarts frequently, causing confirmed payments to have no user to credit.

## How to apply
- `initDb()` must be called before `registerRoutes()` in `server/index.ts`.
- `creditConfirmedPayment` checks `rowCount` after `UPDATE app_users` and rolls back `credited=TRUE` if the user row didn't exist — prevents phantom credits.
- Fallback by `username` if `userId` in the payment label belongs to an old MemStorage session.
- `server/db.ts` is in the esbuild allowlist (`pg` is already listed).

## Key tested scenarios (2026-07-29)
- Register → payment create → server restart → verify: balance correctly credited from PostgreSQL. ✓
- Unauthorized payment create → 401. ✓
- ЮMoney returns net amount after commission (e.g. 387.03 for 399 ₽); verifyYooMoneyPayment accepts amounts ≥ 90% of expected. ✓
- Double-credit prevented by atomic `UPDATE ... WHERE credited=FALSE`. ✓
