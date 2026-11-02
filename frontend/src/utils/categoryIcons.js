// Matches the real category names in the catalog (from the Excel import).
// The old map used names like "Mobile Phones"/"Laptops" that don't exist in the DB,
// so every category fell back to the same 🛍️ icon.
const ICONS = [
  ["mobile", "📱"],
  ["laptop", "💻"],
  ["electronics", "🎧"],
  ["fashion(men)", "👔"],
  ["women", "👗"],
  ["shoes", "👟"],
  ["home", "🍳"],
  ["beauty", "💄"],
  ["toys", "🧸"],
  ["books", "📚"],
  ["sports", "🏋️"],
  ["automotive", "🚗"],
  ["pet", "🐾"],
  ["garden", "🌱"],
  ["grocery", "🛒"],
];

export function categoryIcon(name) {
  const n = (name || "").toLowerCase();
  const hit = ICONS.find(([key]) => n.includes(key));
  return hit ? hit[1] : "🛍️";
}
