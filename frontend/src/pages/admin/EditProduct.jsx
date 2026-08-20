import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";
import ProductForm from "./ProductForm";

const EMPTY = { name: "", brand: "", category: "", price: "", stock: "", image: "", description: "" };

export default function EditProduct() {
  const { id } = useParams();
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    productsApi.getProduct(id).then(({ ok, data }) => {
      if (ok) {
        setForm({
          name: data.name || "",
          brand: data.brand || "",
          category: data.category || "",
          price: data.price || "",
          stock: data.stock || "",
          image: data.image || "",
          description: data.description || "",
        });
      }
    });
  }, [id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { ok, data } = await productsApi.updateProduct(id, form);
    setSubmitting(false);

    if (ok) {
      Swal.fire({ title: "Updated!", text: data.message || "Product updated successfully.", icon: "success", timer: 1800, showConfirmButton: false })
        .then(() => navigate("/admin"));
    } else {
      Swal.fire("Failed", data.message || "Update failed.", "error");
    }
  };

  return (
    <ProductForm
      form={form}
      onChange={setForm}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Update Product"
      icon="fa-pen-to-square"
      iconBg="bg-yellow-50 text-yellow-600"
      title="Edit Product Information"
      subtitle="Update the details for this item in your store catalog."
    />
  );
}
