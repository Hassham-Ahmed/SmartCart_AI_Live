import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { productsApi } from "../api/client";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    if (!user?.id) {
      setCartCount(0);
      return;
    }
    const { ok, data } = await productsApi.cartCount(user.id);
    setCartCount(ok && data.count !== undefined ? data.count : 0);
  }, [user]);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  return (
    <CartContext.Provider value={{ cartCount, refreshCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
