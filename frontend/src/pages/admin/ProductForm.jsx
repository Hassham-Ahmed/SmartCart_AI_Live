export default function ProductForm({ form, onChange, onSubmit, submitLabel, submitting, icon, title, subtitle, iconBg }) {
  const update = (field) => (e) => onChange({ ...form, [field]: e.target.value });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg ${iconBg}`}>
            <i className={`fa-solid ${icon}`} />
          </div>
          <div>
            <h4 className="font-bold text-lg">{title}</h4>
            <p className="text-gray-400 text-sm">{subtitle}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <label className="form-label">Product Name</label>
            <input type="text" value={form.name} onChange={update("name")} className="form-input" placeholder="e.g. Wireless Noise Cancelling Headphones" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Brand</label>
              <input type="text" value={form.brand} onChange={update("brand")} className="form-input" placeholder="e.g. Sony" />
            </div>
            <div>
              <label className="form-label">Category</label>
              <input type="text" value={form.category} onChange={update("category")} className="form-input" placeholder="e.g. Headphones & Earbuds" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Price (PKR)</label>
              <input type="number" value={form.price} onChange={update("price")} className="form-input" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Stock Quantity</label>
              <input type="number" value={form.stock} onChange={update("stock")} className="form-input" placeholder="100" />
            </div>
          </div>

          <div>
            <label className="form-label">Image URL</label>
            <input type="text" value={form.image} onChange={update("image")} className="form-input" placeholder="https://example.com/image.jpg" />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea value={form.description} onChange={update("description")} rows={4} className="form-input" placeholder="Enter detailed product description..." />
          </div>

          <button onClick={onSubmit} disabled={submitting} className="btn-primary w-full py-3 mt-2">
            <i className="fa-solid fa-floppy-disk mr-2" /> {submitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
