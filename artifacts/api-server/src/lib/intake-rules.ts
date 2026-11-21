export type Suggestion = { item: string | null; category: string | null; merchant: string | null; budgetCents: number | null; clarification: string | null; source: "ai" | "rules" };
const vagueWords = /\b(something|anything|stuff|things?|whatever|some)\b/i;
const categoryHints: [RegExp, string][] = [
  [/\b(sock|shirt|hoodie|jacket|shoe|sneaker|jeans|hat|clothing|sweater|pants)s?\b/i, "Clothing"],
  [/\b(book|textbook|notebook|pen|pencil|binder|calculator|folder)s?\b/i, "School supplies"],
  [/\b(snack|coffee|food|pizza|drink|water|meal|lunch|dinner)s?\b/i, "Food and drink"],
  [/\b(charger|cable|laptop|headphone|earbud|phone|keyboard|mouse|adapter)s?\b/i, "Electronics"],
  [/\b(shampoo|soap|toothpaste|lotion|medicine|cold|tissue|vitamin)s?\b/i, "Health and personal care"],
  [/\b(lamp|pillow|blanket|towel|hanger|desk|storage|poster)s?\b/i, "Dorm and home"],
  [/\b(racket|ball|gym|workout|yoga|bike)s?\b/i, "Sports"],
];
export const clarificationFor = (item: string | null) => !item
  ? "What is the item itself? Name the specific thing you want an agent to buy."
  : vagueWords.test(item) || item.trim().split(/\s+/).length < 2
    ? "That item is general. What specific product would you want (for example a type, brand or size)?"
    : null;

// Deterministic fallback used when no model is configured or the model call fails.
// It only reads what the participant wrote; it never invents a budget or a merchant.
export function suggestWithRules(narrative: string, merchants: string[]): Suggestion {
  let text = narrative.trim();
  let budgetCents: number | null = null;
  const budget = text.match(/(?:under|below|max(?:imum)?|up to|less than|around|about|for|budget(?: of)?)?\s*\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks)/i);
  if (budget) {
    const amount = Number(budget[1] ?? budget[2]);
    if (Number.isFinite(amount) && amount > 0 && amount <= 1000000) budgetCents = Math.round(amount * 100);
    text = text.replace(budget[0], " ");
  }
  let merchant: string | null = merchants.find((m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(narrative)) ?? null;
  if (merchant) text = text.replace(new RegExp(merchant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  else {
    const from = text.match(/\b(?:from|at)\s+([A-Z][\w&'’.-]*(?:\s+[A-Z][\w&'’.-]*){0,3})/);
    if (from) { merchant = from[1].trim(); text = text.replace(from[0], " "); }
  }
  const item = text.replace(/\b(?:i(?:'|’)?m looking for|i need|i want|looking for|please buy|buy me|get me|a pair of|a|an|the)\b/gi, " ")
    .replace(/\b(?:from|at|under|for)\s*$/i, " ").replace(/[\s,.;]+/g, " ").trim().slice(0, 240) || null;
  const category = categoryHints.find(([pattern]) => pattern.test(narrative))?.[1] ?? null;
  return { item, category, merchant, budgetCents, clarification: clarificationFor(item), source: "rules" };
}

