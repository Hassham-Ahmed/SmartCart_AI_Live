import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";

export const DELIVERY_FEE = 200;
const PAYMENT_METHODS = ["Cash on Delivery", "Credit / Debit Card", "Easypaisa / JazzCash"];
const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1600 });

export function Modal({ title, onClose, children, wide }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto chat-panel-3d`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
        <h2 className="text-lg font-bold text-gray-800 mb-3 pr-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * "Buy Now" on a chat product card: orders exactly this product + quantity
 * directly (does not touch the cart), same as before the upgrade.
 * Uses the REST endpoint POST /api/products/place-order (shared order service:
 * stock check, order_items, Rs. 200 delivery, last-4-digits-only payment).
 */
export default function QuickCheckout({ product, qty, onClose, onPlaced }) {
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentDetail, setPaymentDetail] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const confirm = async () => {
    if (shippingAddress.trim().length < 8) return toast("warning", "Please enter your complete shipping address.");
    const digits = paymentDetail.replace(/\D/g, "");
    if (paymentMethod !== "Cash on Delivery" && digits.length < 4) return toast("warning", "Please enter your card / wallet number.");

    setPlacingOrder(true);
    const { ok, data } = await productsApi.placeOrder({
      product_id: product.id,
      quantity: qty,
      shipping_address: shippingAddress.trim(),
      payment_method: paymentMethod,
      // Security: only the last 4 digits ever leave the browser (server stores "ending 1234").
      payment_details: paymentMethod === "Cash on Delivery" ? "" : digits.slice(-4),
    });
    setPlacingOrder(false);
    if (!ok) return toast("error", data.message || data.error || "Could not place order.");
    onPlaced({ product, qty, paymentMethod, orderId: data.order_id, total: data.total_amount });
  };

  return (
    <Modal title="⚡ Quick Checkout" onClose={onClose}>
      <p className="text-xs text-gray-600 mb-3">{product.name} (Qty: {qty})</p>
      <div className="bg-gray-50 p-3 rounded-lg mb-4 text-xs space-y-1">
        <p className="flex justify-between"><span>Items</span><span>Rs. {(product.price * qty).toLocaleString()}</span></p>
        <p className="flex justify-between"><span>Delivery</span><span>Rs. {DELIVERY_FEE}</span></p>
        <p className="flex justify-between font-bold text-primary-700"><span>Total</span><span>Rs. {(product.price * qty + DELIVERY_FEE).toLocaleString()}</span></p>
      </div>
      <label htmlFor="qc-address" className="text-xs font-semibold text-gray-700 block mb-1">Delivery Address *</label>
      <textarea id="qc-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="House #, Street, Area, City" rows={2} maxLength={255} className="form-input text-sm mb-3" />
      <fieldset className="space-y-1.5 text-sm">
        <legend className="text-xs font-semibold text-gray-700 mb-1">Payment Method</legend>
        {PAYMENT_METHODS.map((method) => (
          <div key={method} className="border p-2 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="chatPayment" checked={paymentMethod === method} onChange={() => { setPaymentMethod(method); setPaymentDetail(""); }} />
              {method}
            </label>
            {paymentMethod === method && method !== "Cash on Delivery" && (
              <input
                type="text"
                inputMode="numeric"
                autoComplete={method.startsWith("Credit") ? "cc-number" : "tel"}
                aria-label={method.startsWith("Credit") ? "Card number" : "Wallet mobile number"}
                placeholder={method.startsWith("Credit") ? "Card number (only last 4 digits are saved)" : "03xxxxxxxxx"}
                value={paymentDetail}
                maxLength={19}
                onChange={(e) => setPaymentDetail(e.target.value.replace(/[^\d ]/g, ""))}
                className="form-input text-sm mt-2"
              />
            )}
          </div>
        ))}
      </fieldset>
      <button type="button" onClick={confirm} disabled={placingOrder} className="btn-success btn-3d w-full text-sm py-2.5 mt-4">
        {placingOrder ? "Placing Order..." : "Confirm & Place Order"}
      </button>
    </Modal>
  );
}
