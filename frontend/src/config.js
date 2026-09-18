export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export function getImageUrl(imagePath) {
  if (!imagePath) {
    return "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image";
  }
  // Agar full URL hai (http/https) to wahi return karo
  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://")
  ) {
    return imagePath;
  }
  // Fallback: backend se serve karo
  return `${API_BASE_URL}/static/images/${imagePath.split("/").pop()}`;
}