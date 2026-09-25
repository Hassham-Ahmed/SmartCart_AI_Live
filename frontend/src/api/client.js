import { API_BASE_URL as API_BASE } from "../config";

async function request(path, { method = "GET", body, headers } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
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
    const qs = query.toString();
    return request(`/api/products/${qs ? `?${qs}` : ""}`);
  },
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
export const aiApi = {
  chat: (payload) => request("/api/ai/chat", { method: "POST", body: payload }),
};