export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://smart-cart-ai-live.vercel.app";

// Inline SVG placeholder: no extra network request, never 404s (placehold.co /
// via.placeholder.com were used before; via.placeholder.com is offline).
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#eef2f7"/><rect x="170" y="120" width="60" height="60" rx="6" fill="none" stroke="#9ca3af" stroke-width="6"/><circle cx="188" cy="140" r="6" fill="#9ca3af"/><path d="M176 172l18-20 14 14 10-8 12 14z" fill="#9ca3af"/></svg>'
  );

export function getImageUrl(imagePath) {
  if (!imagePath) return PLACEHOLDER_IMAGE;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:")) {
    return imagePath;
  }
  // Fallback: served by the backend
  return `${API_BASE_URL}/static/images/${encodeURIComponent(imagePath.split("/").pop())}`;
}
