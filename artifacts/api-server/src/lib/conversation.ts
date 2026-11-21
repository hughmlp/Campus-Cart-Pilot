import { categoryHints, clarificationFor, suggestWithRules } from "./intake-rules";

export type Draft = {
  item: string | null;
  category: string | null;
  merchant: string | null;
  budgetCents: number | null;
  merchantDecided: boolean;
};
export type Turn = { reply: string; draft: Draft; done: boolean; source: "ai" | "rules" };
export type Need = "item" | "budget" | "merchant" | null;

const noPreference = /^\s*(no|nope|none|any|anything|anywhere|flexible|doesn'?t matter|don'?t care|no preference|not really|whatever)\b/i;
const numberWords: Record<string, number> = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
export const mentionsNumber = (text: string) =>
  /\d/.test(text) || Object.keys(numberWords).some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));

export function parseBudgetCents(text: string): number | null {
  const digits = text.match(/(\d+(?:\.\d{1,2})?)/);
  if (digits) {
    const amount = Number(digits[1]);
    return amount > 0 && amount <= 1000000 ? Math.round(amount * 100) : null;
  }
  const word = Object.keys(numberWords).find((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
  return word ? numberWords[word] * 100 : null;
}

// What the assistant still needs, in order. Category is never asked; it is inferred.
export function nextNeed(draft: Draft, itemAccepted: boolean): Need {
  if (!draft.item || (!itemAccepted && clarificationFor(draft.item))) return "item";
  if (draft.budgetCents == null) return "budget";
  if (!draft.merchantDecided) return "merchant";
  return null;
}

export function questionFor(need: Need, draft: Draft): string {
  if (need === "item") {
    return draft.item
      ? "Can you be a bit more specific? For example, the type, brand or size of what you want."
      : "What would you like me to get?";
  }
  if (need === "budget") return `What is the most you would spend on ${draft.item}, including taxes and fees?`;
  if (need === "merchant") return "Do you have a store in mind? You can say no preference.";
  const price = `$${((draft.budgetCents ?? 0) / 100).toFixed(2)}`;
  return `Got it: ${draft.item}, up to ${price}${draft.merchant ? ` from ${draft.merchant}` : ""}. Check the details and send it when you are ready.`;
}

export function withCategory(draft: Draft): Draft {
  if (draft.category || !draft.item) return draft;
  const hinted = categoryHints.find(([pattern]) => pattern.test(draft.item!))?.[1];
  return { ...draft, category: hinted ?? "Other" };
}

// Deterministic conversation used when no model is configured or the model fails.
// The next question is derived from the draft, so the server keeps no state between turns.
export function converseWithRules(userMessages: string[], draft: Draft, merchants: string[]): Turn {
  const latest = userMessages[userMessages.length - 1] ?? "";
  let next: Draft = { ...draft };
  if (userMessages.length <= 1) {
    const s = suggestWithRules(latest, merchants);
    next = { item: s.item, category: s.category, merchant: s.merchant, budgetCents: s.budgetCents, merchantDecided: Boolean(s.merchant) };
  } else {
    const asked = nextNeed(draft, userMessages.length > 2);
    if (asked === "item") {
      const s = suggestWithRules(latest, merchants);
      next = {
        item: s.item && !clarificationFor(s.item) ? s.item : next.item ?? s.item,
        category: s.category ?? next.category,
        merchant: s.merchant ?? next.merchant,
        budgetCents: s.budgetCents ?? next.budgetCents,
        merchantDecided: next.merchantDecided || Boolean(s.merchant),
      };
    } else if (asked === null) {
      // The draft was complete and the participant said something more: treat it as a correction.
      const corrected = parseBudgetCents(latest);
      if (corrected != null) next.budgetCents = corrected;
    } else if (asked === "budget") {
      next.budgetCents = parseBudgetCents(latest) ?? next.budgetCents;
    } else if (asked === "merchant") {
      if (noPreference.test(latest)) {
        next.merchant = null;
        next.merchantDecided = true;
      } else {
        const known = merchants.find((m) => latest.toLowerCase().includes(m.toLowerCase()));
        next.merchant = (known ?? latest.replace(/^(at|from)\s+/i, "")).trim().slice(0, 160) || null;
        next.merchantDecided = true;
      }
    }
  }
  next = withCategory(next);
  // A vague item is asked about once: after the first follow-up, accept what the person said.
  const need = nextNeed(next, userMessages.length > 1);
  return { reply: questionFor(need, next), draft: next, done: need === null, source: "rules" };
}
