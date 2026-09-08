import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinalCardPrompt,
  buildSellerAnalysisRequest,
  buildSellerAnalysisRule,
} from "./seller-content.ts";
import { SELLER_NOTES_MAX_LENGTH, normalizeSellerNotes, sellerNotesSchema } from "./schema.ts";

test("non-empty seller notes become a factual brief for a designed sales card", () => {
  const notes = "  Натуральный состав — без ароматизаторов  ";

  assert.match(buildSellerAnalysisRule(notes), /Натуральный состав — без ароматизаторов/);
  assert.match(buildSellerAnalysisRule(notes), /3–5 лаконичных выгод/);
  assert.match(buildSellerAnalysisRequest(notes), /Натуральный состав — без ароматизаторов/);
  const finalPrompt = buildFinalCardPrompt("Base prompt", notes);
  assert.match(finalPrompt, /Натуральный состав — без ароматизаторов/);
  assert.match(finalPrompt, /complete, visually striking, sales-focused marketplace product card/);
  assert.match(finalPrompt, /not a plain photo with the brief pasted on it/);
  assert.match(finalPrompt, /3–5 short benefit callouts/);
  assert.match(finalPrompt, /Every visible claim must be traceable/);
  assert.match(finalPrompt, /do not add decorative slogans/);
  assert.match(finalPrompt, /never infer weight, comfort, durability/);
  assert.match(finalPrompt, /do not add smaller duplicate descriptions/);
  assert.doesNotMatch(finalPrompt, /Render only this exact Russian seller text/);
});

test("empty seller notes preserve the standard analysis and generation scenario", () => {
  assert.equal(buildSellerAnalysisRule("   "), "");
  assert.doesNotMatch(buildSellerAnalysisRequest("   "), /Бриф продавца/);

  const prompt = buildFinalCardPrompt("Base prompt", "   ");
  assert.match(prompt, /Add Russian text overlays highlighting product benefits/);
  assert.doesNotMatch(prompt, /Seller brief and mandatory marketplace-card requirements/);
});

test("seller notes use the same length limit in storage validation and AI prompts", () => {
  const oversized = `  ${"я".repeat(SELLER_NOTES_MAX_LENGTH + 20)}  `;
  const normalized = normalizeSellerNotes(oversized);

  assert.equal(normalized.length, SELLER_NOTES_MAX_LENGTH);
  assert.equal(sellerNotesSchema.safeParse(oversized).success, false);
  assert.match(buildSellerAnalysisRule(oversized), new RegExp(normalized));
  assert.doesNotMatch(
    buildFinalCardPrompt("Base prompt", oversized),
    new RegExp("я".repeat(SELLER_NOTES_MAX_LENGTH + 1)),
  );
});