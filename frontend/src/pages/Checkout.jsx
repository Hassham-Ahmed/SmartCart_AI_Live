import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const PROVINCES = ["Sindh", "Punjab", "KPK", "Balochistan", "Islamabad"];
const DELIVERY_FEE = 200;

export default function Checkout() {
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

    // Construct final shipping address string
    const fullShippingAddress = `${address.trim()}, ${city}, ${province} (Phone: ${phone})`;
    
    // Construct payment string with payload details if card/wallet selected
    let finalPaymentMethod = payment;
    if (payment === "Credit / Debit Card" && cardNumber) {
      finalPaymentMethod = `Credit / Debit Card (Ending **** ${cardNumber.slice(-4)})`;
    } else if (payment === "Easypaisa / JazzCash" && walletNumber) {
      finalPaymentMethod = `Easypaisa / JazzCash (${walletNumber})`;
    }

    setPlacing(true);
    const { ok, data } = await productsApi.placeOrder({
      user_id: user.id,
      shipping_address: fullShippingAddress,
      payment_method: finalPaymentMethod,
    });
    setPlacing(false);

    if (ok) {
      Swal.fire({
        title: "Order Placed!",
        text: data.message || "Your order has been placed successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        refreshCartCount();
        navigate("/order-success");
      });
    } else {
      Swal.fire("Order Failed", data.message || "Something went wrong.", "error");
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
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" defaultValue={user?.email} disabled className="form-input bg-gray-100" />
              </div>
              <div>
                <label className="form-label">Phone *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                  placeholder="+92 300 0000000"
                />
              </div>
              <div>
                <label className="form-label">Province</label>
                <select className="form-input" value={province} onChange={(e) => setProvince(e.target.value)}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="form-input"
                  placeholder="Karachi"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Complete Delivery Address *</label>
                <textarea
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
                        placeholder="Card Number (16 digits)"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="form-input text-xs w-full mt-1"
                        maxLength={16}
                      />
                    </div>
                  )}

                  {/* Wallet Dynamic Input */}
                  {payment === "Easypaisa / JazzCash" && m.id === "Easypaisa / JazzCash" && (
                    <div className="mt-2 text-xs">
                      <input
                        type="text"
                        placeholder="Mobile Wallet Number (03xxxxxxxxx)"
                        value={walletNumber}
                        onChange={(e) => setWalletNumber(e.target.value)}
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
            <small className="text-gray-400 text-center block mt-3">🔒 256-bit SSL Encrypted Payment</small>
          </div>
        </div>
      </div>
    </div>
  );
}