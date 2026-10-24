import { useState } from 'react';

export default function ProductForm({ form, categories, onClose, onSave }) {
  const [state, setState] = useState(form);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card wide"
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onSave({
              sku: state.sku,
              name: state.name,
              description: state.description,
              categoryId: state.categoryId || null,
              unit: state.unit,
              barcode: state.barcode,
              costPrice: Number(state.costPrice || 0),
              salePrice: Number(state.salePrice || 0),
              stockQty: Number(state.stockQty || 0),
              minStock: Number(state.minStock || 0),
              active: true,
            });
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
      >
        <div className="border-b border-[#dadce0] px-5 py-4 text-lg">
          {state.id ? 'Editar producto' : 'Nuevo producto'}
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
          <label className="field">
            <span>SKU</span>
            <input value={state.sku} onChange={(e) => set('sku', e.target.value)} required />
          </label>
          <label className="field">
            <span>Nombre</span>
            <input value={state.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={state.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Unidad</span>
            <input value={state.unit} onChange={(e) => set('unit', e.target.value)} />
          </label>
          <label className="field">
            <span>Código de barras</span>
            <input value={state.barcode} onChange={(e) => set('barcode', e.target.value)} />
          </label>
          <label className="field">
            <span>Costo</span>
            <input type="number" min="0" step="0.01" value={state.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
          </label>
          <label className="field">
            <span>Precio de venta</span>
            <input type="number" min="0" step="0.01" value={state.salePrice} onChange={(e) => set('salePrice', e.target.value)} />
          </label>
          {!state.id && (
            <label className="field">
              <span>Stock inicial</span>
              <input type="number" min="0" step="0.001" value={state.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Stock mínimo</span>
            <input type="number" min="0" step="0.001" value={state.minStock} onChange={(e) => set('minStock', e.target.value)} />
          </label>
          <label className="field sm:col-span-2">
            <span>Descripción</span>
            <textarea rows={2} value={state.description} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button type="button" className="pill-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="pill-btn primary" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

export function emptyProduct() {
  return {
    id: null,
    sku: '',
    name: '',
    description: '',
    categoryId: '',
    unit: 'un',
    barcode: '',
    costPrice: '',
    salePrice: '',
    stockQty: '',
    minStock: '',
  };
}

export function toProductForm(row) {
  return {
    id: row.id,
    sku: row.sku || '',
    name: row.name || '',
    description: row.description || '',
    categoryId: row.category_id || '',
    unit: row.unit || 'un',
    barcode: row.barcode || '',
    costPrice: row.cost_price || '',
    salePrice: row.sale_price || '',
    stockQty: row.stock_qty || '',
    minStock: row.min_stock || '',
  };
}
