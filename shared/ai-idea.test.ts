import assert from "node:assert/strict";
import test from "node:test";
import { applyAiIdea, receiveAiIdea } from "./ai-idea.ts";

test("receiving an AI idea does not change non-empty seller text", () => {
  assert.deepEqual(receiveAiIdea("Мой текст", "Идея AI"), {
    notes: "Мой текст",
    suggestedIdea: "Идея AI",
  });
});

test("an AI idea fills an empty field immediately", () => {
  assert.deepEqual(receiveAiIdea("  ", "  Идея AI  "), {
    notes: "Идея AI",
    suggestedIdea: "",
  });
});

test("insert appends the idea and clears the suggestion", () => {
  assert.deepEqual(applyAiIdea("Мой текст", "Идея AI", "insert"), {
    notes: "Мой текст\nИдея AI",
    suggestedIdea: "",
  });
});

test("replace explicitly replaces the seller text", () => {
  assert.deepEqual(applyAiIdea("Мой текст", "Идея AI", "replace"), {
    notes: "Идея AI",
    suggestedIdea: "",
  });
});

test("dismiss keeps the seller text and clears the suggestion", () => {
  assert.deepEqual(applyAiIdea("Мой текст", "Идея AI", "dismiss"), {
    notes: "Мой текст",
    suggestedIdea: "",
  });
});