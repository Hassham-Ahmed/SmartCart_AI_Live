const ICONS = {
  Laptops: "💻",
  "Mobile Phones": "📱",
  "Smart Watches": "⌚",
  "Headphones & Earbuds": "🎧",
  Cameras: "📷",
  Tablets: "🖥️",
  "TVs & Monitors": "📺",
  Printers: "🖨️",
  "Keyboards & Mice": "⌨️",
  Speakers: "🔊",
};

export function categoryIcon(name) {
  return ICONS[name] || "🛍️";
}
