import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { SELLER_NOTES_MAX_LENGTH } from "../shared/schema.ts";
import { registerRoutes } from "./routes.ts";
import { storage, type AppUser } from "./storage.ts";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function testUser(): AppUser {
  const expiresAt = new Date(Date.now() + 60_000);
  return {
    id: "notes-limit-user",
    username: "notes-limit@example.test",
    password: "unused",
    passwordHash: "unused",
    email: "notes-limit@example.test",
    nano2Balance: 3,
    proBalance: 0,
    starsBalance: 0,
    nano2Subscription: { cards: 3, expiresAt },
    proSubscription: { cards: 0, expiresAt },
    trialNano2Used: false,
    trialNano2Count: 0,
    trialProUsed: false,
    trialTryonUsed: false,
    emailVerified: true,
    isDeveloper: false,
    createdAt: new Date(),
  };
}

async function startGenerateApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.session = { userId: "notes-limit-user" } as typeof req.session;
    next();
  });
  const server = createServer(app);
  await registerRoutes(server, app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    server,
    url: `http://127.0.0.1:${address.port}/api/generate`,
  };
}

function generationForm(notes: string): FormData {
  const form = new FormData();
  form.append("image", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "pixel.png");
  form.append("model", "nano-banana-2");
  form.append("notes", notes);
  return form;
}

test("POST /api/generate rejects oversized notes before consuming balance or a trial", async () => {
  const originalGetUser = storage.getAppUserById;
  const originalConsume = storage.consumeEntitlement;
  const user = testUser();
  let userLookups = 0;
  let entitlementConsumptions = 0;

  storage.getAppUserById = async () => {
    userLookups += 1;
    return user;
  };
  storage.consumeEntitlement = async () => {
    entitlementConsumptions += 1;
    return { usedTrial: false };
  };

  const { server, url } = await startGenerateApp();
  try {
    const before = {
      balance: user.nano2Subscription.cards,
      trialUsed: user.trialNano2Used,
      trialCount: user.trialNano2Count,
    };
    const response = await fetch(url, {
      method: "POST",
      body: generationForm("я".repeat(SELLER_NOTES_MAX_LENGTH + 1)),
    });
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 400);
    assert.equal(body.error, `Описание не должно превышать ${SELLER_NOTES_MAX_LENGTH} символов`);
    assert.equal(userLookups, 0);
    assert.equal(entitlementConsumptions, 0);
    assert.deepEqual(
      {
        balance: user.nano2Subscription.cards,
        trialUsed: user.trialNano2Used,
        trialCount: user.trialNano2Count,
      },
      before,
    );
  } finally {
    storage.getAppUserById = originalGetUser;
    storage.consumeEntitlement = originalConsume;
    server.close();
    await once(server, "close");
  }
});

test("POST /api/generate accepts notes exactly at the shared limit", async () => {
  const originalGetUser = storage.getAppUserById;
  const originalConsume = storage.consumeEntitlement;
  const user = testUser();
  let entitlementChecks = 0;

  storage.getAppUserById = async () => user;
  storage.consumeEntitlement = async () => {
    entitlementChecks += 1;
    return null;
  };

  const { server, url } = await startGenerateApp();
  try {
    const response = await fetch(url, {
      method: "POST",
      body: generationForm("я".repeat(SELLER_NOTES_MAX_LENGTH)),
    });
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 403);
    assert.match(body.error || "", /Лимит пробных карточек исчерпан/);
    assert.equal(entitlementChecks, 1);
  } finally {
    storage.getAppUserById = originalGetUser;
    storage.consumeEntitlement = originalConsume;
    server.close();
    await once(server, "close");
  }
});