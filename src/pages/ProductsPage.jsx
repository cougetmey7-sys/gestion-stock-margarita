import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, attachmentFileUrl } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import ProductForm, { emptyProduct, toProductForm } from '../components/ProductForm';
import StockAdjustModal from '../components/StockAdjustModal';
import { money, qty } from '../format';
import { useStore } from '../store';

export default function ProductsPage() {
  const { currency } = useStore();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [categoryId, setCategoryId] = useState(params.get('categoryId') || '');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const search = new URLSearchParams();
    if (q.trim()) search.set('q', q.trim());
    if (categoryId) search.set('categoryId', categoryId);
    return `?${search.toString()}`;
  }, [q, categoryId]);

  async function load() {
    const [products, cats] = await Promise.all([api.products(query), api.categories()]);
    setRows(products.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (q.trim()) next.set('q', q.trim());
        else next.delete('q');
        if (categoryId) next.set('categoryId', categoryId);
        else next.delete('categoryId');
        return next;
      }, { replace: true });
      load().catch((err) => setError(err.message));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">Productos</h1>
        <input
          className="h-9 w-full min-w-0 rounded-full border border-[#dadce0] px-4 text-sm outline-none focus:border-[#e0a800] sm:w-auto sm:min-w-[220px]"
          placeholder="Buscar SKU, nombre o código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-9 rounded-full border border-[#dadce0] px-3 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button className="pill-btn primary" onClick={() => setEditing(emptyProduct())}>
          Nuevo producto
        </button>
      </div>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!newCategory.trim()) return;
          await api.saveCategory({ name: newCategory.trim() });
          setNewCategory('');
          await load();
        }}
      >
        <input
          className="h-9 rounded-full border border-[#dadce0] px-4 text-sm"
          placeholder="Nueva categoría"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button className="pill-btn" type="submit">
          Agregar categoría
        </button>
      </form>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th>Costo</th>
              <th>Precio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {row.photo_id ? (
                      <img
                        src={attachmentFileUrl(row.photo_id)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border border-[#dadce0] object-cover"
                      />
                    ) : (
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-[#dadce0] text-xs text-[#70757a]">
                        Foto
                      </div>
                    )}
                    <div>
                      <Link className="font-medium text-[#8a5a00]" to={`/productos/${row.id}`}>
                        {row.name}
                      </Link>
                      <div className="text-xs text-[#70757a]">{row.sku}</div>
                    </div>
                  </div>
                </td>
                <td>{row.category_name || '—'}</td>
                <td>
                  {qty(row.stock_qty)} {row.unit}
                </td>
                <td>{money(row.cost_price, currency)}</td>
                <td>{money(row.sale_price, currency)}</td>
                <td className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="pill-btn" onClick={() => setAdjusting(row)}>
                      Stock
                    </button>
                    <button className="pill-btn" onClick={() => setEditing(toProductForm(row))}>
                      Editar
                    </button>
                    <button className="pill-btn danger" onClick={() => setRemoving(row)}>
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="py-8 text-center text-[#70757a]" colSpan={6}>
                  No hay productos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (body) => {
            await api.adjustStock(adjusting.id, body);
            setAdjusting(null);
            await load();
          }}
        />
      )}
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${removing.name}`}
          message={`Se va a borrar el producto ${removing.name} (${removing.sku}) y su historial de stock. Si está en ventas o compras, primero hay que borrar esos comprobantes.`}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.deleteProduct(removing.id);
            setRemoving(null);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await api.saveProduct(editing.id, body);
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
