import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import useDocumentTitle from "../hooks/useDocumentTitle";

const PROVINCES = ["Sindh", "Punjab", "KPK", "Balochistan", "Islamabad"];
const DELIVERY_FEE = 200;

export default function Checkout() {
  useDocumentTitle("Checkout");
  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Karachi");
  const [province, setProvince] = useState("Sindh");
  const [address, setAddress] = useState("");
  
  // Payment states
  const [payment, setPayment] = useState("Cash on Delivery");
  const [cardNumber, setCardNumber] = useState("");
  const [walletNumber, setWalletNumber] = useState("");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    productsApi.getCart(user.id).then(({ ok, data }) => ok && setItems(data));
  }, [user]);

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = itemsTotal > 0 ? itemsTotal + DELIVERY_FEE : 0;

  const handlePlaceOrder = async () => {
    if (!address.trim() || !phone.trim()) {
      Swal.fire({ title: "Details Required", text: "Please fill phone number and delivery address.", icon: "warning" });
      return;
    }
    if (!/^\+?[\d\s-]{10,15}$/.test(phone.trim())) {
      Swal.fire({ title: "Check your phone number", text: "Please enter a valid phone number, e.g. 0300 1234567.", icon: "warning" });
      return;
    }
    const detail = payment === "Credit / Debit Card" ? cardNumber : payment === "Easypaisa / JazzCash" ? walletNumber : "";
    const digits = detail.replace(/\D/g, "");
    if (payment !== "Cash on Delivery" && digits.length < 4) {
      Swal.fire({ title: "Payment details", text: "Please enter your card / wallet number.", icon: "warning" });
      return;
    }

    const fullShippingAddress = `${fullName.trim() ? fullName.trim() + ", " : ""}${address.trim()}, ${city.trim()}, ${province} (Phone: ${phone.trim()})`;

    setPlacing(true);
    const { ok, data } = await productsApi.placeOrder({
      shipping_address: fullShippingAddress,
      payment_method: payment,
      // Security: only the last 4 digits are sent; the server stores "ending 1234".
      payment_details: digits.slice(-4),
    });
    setPlacing(false);

    if (ok) {
      refreshCartCount();
      navigate("/order-success", { replace: true, state: { orderId: data.order_id, total: data.total_amount } });
    } else {
      Swal.fire("Order Failed", data.message || data.error || "Something went wrong.", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="card p-6">
            <h3 className="text-xl font-bold mb-5">🚚 Shipping Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkout-full-name" className="form-label">Full Name</label>
                <input id="checkout-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label htmlFor="checkout-email" className="form-label">Email</label>
                <input id="checkout-email" type="email" defaultValue={user?.email} disabled className="form-input bg-gray-100" />
              </div>
              <div>
                <label htmlFor="checkout-phone" className="form-label">Phone *</label>
                <input id="checkout-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                  placeholder="+92 300 0000000"
                />
              </div>
              <div>
                <label htmlFor="checkout-province" className="form-label">Province</label>
                <select id="checkout-province" className="form-input" value={province} onChange={(e) => setProvince(e.target.value)}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-city" className="form-label">City</label>
                <input id="checkout-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="form-input"
                  placeholder="Karachi"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-complete-delivery-address" className="form-label">Complete Delivery Address *</label>
                <textarea id="checkout-complete-delivery-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="form-input"
                  placeholder="House #, Street, Block, Area..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="card p-6">
            <h4 className="text-lg font-bold mb-3">Order Summary</h4>
            <hr className="mb-3" />
            <div className="flex justify-between mb-2 text-sm">
              <span className="text-gray-500">Items Total:</span>
              <strong>Rs. {itemsTotal.toLocaleString()}</strong>
            </div>
            <div className="flex justify-between mb-3 text-sm text-success-600">
              <span>Delivery Fee:</span>
              <strong>{itemsTotal > 0 ? `Rs. ${DELIVERY_FEE}` : "Free"}</strong>
            </div>
            <hr className="mb-3" />
            <div className="flex justify-between mb-4">
              <h5 className="font-bold">Total Amount:</h5>
              <h5 className="font-bold text-primary-600">Rs. {grandTotal.toLocaleString()}</h5>
            </div>

            <h6 className="font-bold mb-2 text-sm">Payment Method</h6>
            <div className="flex flex-col gap-3 mb-6">
              {[
                { id: "Cash on Delivery", label: "Cash on Delivery" },
                { id: "Credit / Debit Card", label: "Credit / Debit Card" },
                { id: "Easypaisa / JazzCash", label: "Easypaisa / JazzCash" },
              ].map((m) => (
                <div key={m.id} className="border p-3 rounded-lg">
                  <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === m.id}
                      onChange={() => setPayment(m.id)}
                    />
                    {m.label}
                  </label>

                  {/* Card Dynamic Input */}
                  {payment === "Credit / Debit Card" && m.id === "Credit / Debit Card" && (
                    <div className="mt-2 text-xs space-y-2">
                      <input
                        type="text"
                        placeholder="Card number (only last 4 digits are saved)"
                        aria-label="Card number"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/[^\d ]/g, ""))}
                        className="form-input text-xs w-full mt-1"
                        maxLength={19}
                      />
                    </div>
                  )}

                  {/* Wallet Dynamic Input */}
                  {payment === "Easypaisa / JazzCash" && m.id === "Easypaisa / JazzCash" && (
                    <div className="mt-2 text-xs">
                      <input
                        type="text"
                        placeholder="Mobile Wallet Number (03xxxxxxxxx)"
                        aria-label="Wallet mobile number"
                        inputMode="numeric"
                        value={walletNumber}
                        onChange={(e) => setWalletNumber(e.target.value.replace(/\D/g, ""))}
                        className="form-input text-xs w-full mt-1"
                        maxLength={11}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handlePlaceOrder} disabled={placing || items.length === 0} className="btn-success w-full py-3">
              {placing ? "Placing Order..." : "Place Order Now"}
            </button>
            <small className="text-gray-500 text-center block mt-3">🔒 Secure HTTPS checkout - we never store full card numbers</small>
          </div>
        </div>
      </div>
    </div>
  );
}