export type AiIdeaResult = {
  notes: string;
  suggestedIdea: string;
};

export function receiveAiIdea(notes: string, idea: string): AiIdeaResult {
  const cleanIdea = idea.trim();
  return notes.trim()
    ? { notes, suggestedIdea: cleanIdea }
    : { notes: cleanIdea, suggestedIdea: "" };
}

export function applyAiIdea(
  notes: string,
  suggestedIdea: string,
  action: "insert" | "replace" | "dismiss",
): AiIdeaResult {
  if (action === "dismiss") return { notes, suggestedIdea: "" };
  if (action === "replace") return { notes: suggestedIdea, suggestedIdea: "" };

  const currentNotes = notes.trim();
  return {
    notes: currentNotes ? `${currentNotes}\n${suggestedIdea}` : suggestedIdea,
    suggestedIdea: "",
  };
}