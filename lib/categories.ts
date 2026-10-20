export interface Category {
  id: string;
  label: string;
  icon: string; // glyph shown in the app
  color: string; // tailwind-compatible hex
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: "food", label: "Food & Dining", icon: "🍽", color: "#ff9f0a", keywords: ["food", "biryani", "lunch", "dinner", "breakfast", "restaurant", "chai", "coffee", "snack", "burger", "pizza", "karahi", "bbq", "meal", "ate"] },
  { id: "groceries", label: "Groceries", icon: "🛒", color: "#30d158", keywords: ["grocery", "groceries", "mart", "store", "kirana", "vegetable", "fruit", "milk", "bread", "rations"] },
  { id: "transport", label: "Transport", icon: "⛽", color: "#0a84ff", keywords: ["petrol", "fuel", "gas", "uber", "careem", "taxi", "rickshaw", "bus", "fare", "ride", "parking", "toll", "metro", "bykea", "indrive"] },
  { id: "bills", label: "Bills & Utilities", icon: "💡", color: "#ffd60a", keywords: ["bill", "electricity", "k-electric", "water", "internet", "wifi", "mobile", "recharge", "balance", "rent", "gas bill", "utility"] },
  { id: "shopping", label: "Shopping", icon: "🛍", color: "#bf5af2", keywords: ["shopping", "clothes", "shoes", "shirt", "dress", "daraz", "mall", "bought", "amazon"] },
  { id: "health", label: "Health", icon: "💊", color: "#ff453a", keywords: ["doctor", "medicine", "pharmacy", "hospital", "clinic", "dentist", "checkup", "meds"] },
  { id: "entertainment", label: "Entertainment", icon: "🎬", color: "#ff375f", keywords: ["movie", "cinema", "netflix", "game", "spotify", "concert", "outing", "fun", "ps5", "steam"] },
  { id: "obligations", label: "Obligations", icon: "🤝", color: "#ff9f0a", keywords: ["obligation", "owe", "debt", "repay", "paid back", "settle"] },
  { id: "loan_given", label: "Loan Given", icon: "↗", color: "#64d2ff", keywords: ["lent", "gave loan", "udhaar diya", "borrowed from me"] },
  { id: "loan_taken", label: "Loan Taken", icon: "↙", color: "#ac8e68", keywords: ["borrowed", "took loan", "udhaar", "owe"] },
  { id: "family", label: "Family & Gifts", icon: "🎁", color: "#ff6482", keywords: ["gift", "family", "parents", "eidi", "wedding", "birthday", "ammi", "abu"] },
  { id: "education", label: "Education", icon: "📚", color: "#5e5ce6", keywords: ["course", "book", "tuition", "fee", "exam", "udemy", "school", "university"] },
  { id: "income", label: "Income", icon: "💵", color: "#30d158", keywords: ["salary", "pay", "bonus", "earned", "received", "payment received", "freelance"] },
  { id: "other", label: "Other", icon: "•", color: "#98989d", keywords: [] },
];

export const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => !["loan_given", "loan_taken", "income"].includes(c.id)
);

export function categorize(note: string, kind?: string): string {
  const text = note.toLowerCase();
  if (kind === "loan_given") return "loan_given";
  if (kind === "loan_taken") return "loan_taken";
  if (kind === "income") return "income";
  let best = "other";
  let bestScore = 0;
  for (const c of CATEGORIES) {
    for (const k of c.keywords) {
      if (text.includes(k) && k.length > bestScore) {
        best = c.id;
        bestScore = k.length;
      }
    }
  }
  return best;
}

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
