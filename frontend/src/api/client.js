import { API_BASE_URL as API_BASE } from "../config";

const TOKEN_KEY = "smartcart_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) - session will be memory-only */
  }
}

// Called when the API says our token is missing/expired (set by AuthProvider).
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = "GET", body, headers, signal } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: {
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return { ok: false, status: 0, data: { message: "Network error - please check your connection." } };
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && getToken() && onUnauthorized) onUnauthorized();
  return { ok: response.ok, status: response.status, data };
}

// ---------------- AUTH ----------------
export const authApi = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  getUsers: () => request("/api/auth/admin/users"),
  deleteUser: (id) => request(`/api/auth/delete-user/${id}`, { method: "DELETE" }),
  toggleStatus: (id) => request(`/api/auth/toggle-status/${id}`, { method: "PUT" }),
  getProfile: (userId) => request(`/api/auth/profile/${userId}`),
  updateProfile: (payload) => request("/api/auth/update-profile", { method: "PUT", body: payload }),
  uploadProfileImage: (file) => {
    const form = new FormData();
    form.append("profile_image", file);
    return request("/api/auth/upload-profile-image", { method: "POST", body: form });
  },
  changePassword: (payload) => request("/api/auth/change-password", { method: "PUT", body: payload }),
  contact: (payload) => request("/api/auth/contact", { method: "POST", body: payload }),
  getContactMessages: () => request("/api/auth/contact-messages"),
  deleteMessage: (id) => request(`/api/auth/delete-message/${id}`, { method: "DELETE" }),
  subscribe: (email) => request("/api/auth/subscribe", { method: "POST", body: { email } }),
};

// ---------------- PRODUCTS / CART / ORDERS ----------------
export const productsApi = {
  getProducts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    if (params.limit) query.set("limit", params.limit);
    const qs = query.toString();
    return request(`/api/products/${qs ? `?${qs}` : ""}`);
  },
  // BUGFIX: EditProduct called productsApi.getProduct() which did not exist.
  getProduct: (id) => request(`/api/products/${id}`),
  recordView: (id) => request(`/api/products/${id}/view`, { method: "POST" }),
  addProduct: (payload) => request("/api/products/add-product", { method: "POST", body: payload }),
  updateProduct: (id, payload) => request(`/api/products/update-product/${id}`, { method: "PUT", body: payload }),
  deleteProduct: (id) => request(`/api/products/delete-product/${id}`, { method: "DELETE" }),

  addToCart: (payload) => request("/api/products/add-to-cart", { method: "POST", body: payload }),
  getCart: (userId) => request(`/api/products/cart/${userId}`),
  cartCount: (userId) => request(`/api/products/cart-count/${userId}`),
  increaseQuantity: (cartId) => request(`/api/products/increase/${cartId}`, { method: "PUT" }),
  decreaseQuantity: (cartId) => request(`/api/products/decrease/${cartId}`, { method: "PUT" }),
  removeCartItem: (cartId) => request(`/api/products/remove/${cartId}`, { method: "DELETE" }),

  placeOrder: (payload) => request("/api/products/place-order", { method: "POST", body: payload }),
  myOrders: (userId) => request(`/api/products/my-orders/${userId}`),
  orderDetails: (orderId) => request(`/api/products/orders/${orderId}`),

  addToWishlist: (payload) => request("/api/products/add-to-wishlist", { method: "POST", body: payload }),
  getWishlist: (userId) => request(`/api/products/wishlist/${userId}`),
  removeWishlist: (id) => request(`/api/products/remove-wishlist/${id}`, { method: "DELETE" }),

  addReview: (payload) => request("/api/products/add-review", { method: "POST", body: payload }),
  getReviews: (productId) => request(`/api/products/reviews/${productId}`),
  getRating: (productId) => request(`/api/products/rating/${productId}`),
  getTopReviews: () => request("/api/products/reviews/top"),

  getCategories: () => request("/api/products/categories"),

  adminDashboard: () => request("/api/products/admin/dashboard"),
  adminOrders: () => request("/api/products/admin/orders"),
  updateOrderStatus: (id, status) => request(`/api/products/update-order-status/${id}`, { method: "PUT", body: { status } }),
};

// ---------------- AI ASSISTANT ----------------
/**
 * Stream a chat turn over Server-Sent Events (POST + fetch ReadableStream,
 * since EventSource can't POST or send an Authorization header).
 * Works even if a proxy buffers the response: we parse whatever arrives.
 */
async function streamChat({ message, sessionId, onEvent, signal }) {
  const response = await fetch(`${API_BASE}/api/ai/chat/stream`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...authHeaders() },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.reply || data.error || "Request failed"), { status: response.status, data });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    // very old browsers: no streaming body - parse it all at once
    parseSSE(await response.text(), onEvent);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const cut = buffer.lastIndexOf("\n\n");
    if (cut !== -1) {
      parseSSE(buffer.slice(0, cut), onEvent);
      buffer = buffer.slice(cut + 2);
    }
  }
  if (buffer.trim()) parseSSE(buffer, onEvent);
}

function parseSSE(chunk, onEvent) {
  for (const block of chunk.split("\n\n")) {
    let event = "message";
    const data = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) continue;
    try {
      const payload = JSON.parse(data.join("\n"));
      onEvent(event === "session" ? { type: "session", ...payload } : payload);
    } catch {
      /* ignore malformed frame */
    }
  }
}

export const aiApi = {
  chat: (payload) => request("/api/ai/chat", { method: "POST", body: payload }),
  streamChat,
  resetContext: (sessionId) => request(`/api/ai/context?session_id=${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
  runTool: (name, args, sessionId) =>
    request(`/api/ai/tools/${name}`, { method: "POST", body: { args, session_id: sessionId } }),
};
