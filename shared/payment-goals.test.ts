import assert from "node:assert/strict";
import test from "node:test";
import { getCardsPaymentGoal, getStarsPaymentGoal } from "./payment-goals.ts";

test("keeps existing Nano Banana 2 payment goals", () => {
  assert.deepEqual(
    [5, 11, 50, 100].map((cards) => getCardsPaymentGoal(cards, "nano2")),
    ["pay_pack_5", "pay_pack_10", "pay_pack_50", "pay_pack_100"],
  );
});

test("uses separate payment goals for Nano Banana Pro", () => {
  assert.deepEqual(
    [5, 11, 50, 100].map((cards) => getCardsPaymentGoal(cards, "pro")),
    ["pay_pro_5", "pay_pro_10", "pay_pro_50", "pay_pro_100"],
  );
});

test("keeps stars payment goals unchanged", () => {
  assert.deepEqual(
    [10, 50, 100, 250].map(getStarsPaymentGoal),
    ["pay_stars_10", "pay_stars_50", "pay_stars_100", "pay_stars_250"],
  );
});

test("does not create goals for unsupported package sizes", () => {
  assert.equal(getCardsPaymentGoal(20, "nano2"), null);
  assert.equal(getCardsPaymentGoal(20, "pro"), null);
  assert.equal(getStarsPaymentGoal(20), null);
});