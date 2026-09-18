// Vercel par ye env variables set karne hain:
// VITE_API_URL = https://smart-cart-ai-live.vercel.app
// VITE_IMAGE_URL = /images   (ya full URL)

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Agar image URL http se start ho rahi hai to wahi use karo,
// warna frontend ke /images/ folder se serve karo
export const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_URL || "/images";

// Helper function - har jagah yahi use karo
export function getImageUrl(imagePath) {
  if (!imagePath) return "https://placehold.co/300x300/png?text=No+Image";
  // Agar full URL hai (http/https) to wahi return karo
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  // Agar backend relative path hai (e.g., "static/images/x.jpg") to sirf filename lo
  const filename = imagePath.split("/").pop();
  return `${IMAGE_BASE_URL}/${filename}`;
}