import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";
import ProductForm from "./ProductForm";

const EMPTY = { name: "", brand: "", category: "", price: "", stock: "", image: "", description: "" };

export default function AddProduct() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price) {
      Swal.fire({ title: "Missing Fields", text: "Please enter product name and price.", icon: "warning" });
      return;
    }

    setSubmitting(true);
    const { ok, data } = await productsApi.addProduct({
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category.trim(),
      price: form.price,
      stock: form.stock,
      image: form.image.trim(),
      description: form.description.trim(),
    });
    setSubmitting(false);

    if (ok) {
      Swal.fire({ title: "Added!", text: data.message || "Product added successfully.", icon: "success", timer: 1800, showConfirmButton: false })
        .then(() => navigate("/admin"));
    } else {
      Swal.fire("Failed", data.message || "Could not add product.", "error");
    }
  };

  return (
    <ProductForm
      form={form}
      onChange={setForm}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Save Product"
      icon="fa-plus"
      iconBg="bg-primary-50 text-primary-600"
      title="Add New Product"
      subtitle="Fill in the details below to add a product to the store inventory."
    />
  );
}
