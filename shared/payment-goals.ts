export type CardModel = "nano2" | "pro";

export function getCardsPaymentGoal(cards: number, model: CardModel): string | null {
  const goalPrefix = model === "pro" ? "pay_pro" : "pay_pack";

  if (cards === 5) return `${goalPrefix}_5`;
  if (cards === 11) return `${goalPrefix}_10`;
  if (cards === 50) return `${goalPrefix}_50`;
  if (cards === 100) return `${goalPrefix}_100`;
  return null;
}

export function getStarsPaymentGoal(stars: number): string | null {
  if (stars === 10) return "pay_stars_10";
  if (stars === 50) return "pay_stars_50";
  if (stars === 100) return "pay_stars_100";
  if (stars === 250) return "pay_stars_250";
  return null;
}