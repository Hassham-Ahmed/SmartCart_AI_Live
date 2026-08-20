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
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("Cash on Delivery");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    productsApi.getCart(user.id).then(({ ok, data }) => ok && setItems(data));
  }, [user]);

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = itemsTotal > 0 ? itemsTotal + DELIVERY_FEE : 0;

  const handlePlaceOrder = async () => {
    if (address.trim() === "") {
      Swal.fire({ title: "Address Required", text: "Please enter your shipping address.", icon: "warning" });
      return;
    }

    setPlacing(true);
    const { data } = await productsApi.placeOrder({
      user_id: user.id,
      shipping_address: address.trim(),
      payment_method: payment,
    });
    setPlacing(false);

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
                <input type="text" defaultValue={user?.full_name} className="form-input" placeholder="Full Name" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" defaultValue={user?.email} className="form-input" placeholder="email@example.com" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="text" className="form-input" placeholder="+92 300 0000000" />
              </div>
              <div>
                <label className="form-label">Province</label>
                <select className="form-input" defaultValue="">
                  <option value="" disabled>Select Province</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">City</label>
                <input type="text" className="form-input" placeholder="Karachi" />
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
              <span>Delivery:</span>
              <strong>{itemsTotal > 0 ? `Rs. ${DELIVERY_FEE}` : "Free"}</strong>
            </div>
            <hr className="mb-3" />
            <div className="flex justify-between mb-4">
              <h5 className="font-bold">Total Amount:</h5>
              <h5 className="font-bold text-primary-600">Rs. {grandTotal.toLocaleString()}</h5>
            </div>

            <h6 className="font-bold mb-2 text-sm">Payment Method</h6>
            <div className="flex flex-col gap-2 mb-6">
              {["Cash on Delivery", "Credit / Debit Card", "Easypaisa / JazzCash"].map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                  />
                  {method}
                </label>
              ))}
            </div>

            <button onClick={handlePlaceOrder} disabled={placing} className="btn-success w-full py-3">
              {placing ? "Placing Order..." : "Place Order Now"}
            </button>
            <small className="text-gray-400 text-center block mt-3">🔒 256-bit SSL Encrypted Payment</small>
          </div>
        </div>
      </div>
    </div>
  );
}
