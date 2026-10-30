import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ConfirmDangerModal from '../components/ConfirmDangerModal';
import ProductForm, { toProductForm } from '../components/ProductForm';
import StockAdjustModal from '../components/StockAdjustModal';
import { MOVEMENT_KINDS, money, qty, ymd } from '../format';
import { useStore } from '../store';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useStore();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [res, cats] = await Promise.all([api.product(id), api.categories()]);
    setProduct(res.data);
    setCategories(cats.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  if (!product) return <div className="p-6 text-[#70757a]">{error || 'Cargando…'}</div>;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link className="text-sm text-[#8a5a00]" to="/productos">
            ← Productos
          </Link>
          <h1 className="text-2xl">{product.name}</h1>
          <div className="text-sm text-[#70757a]">
            {product.sku} · {product.category_name || 'Sin categoría'}
          </div>
        </div>
        <button className="pill-btn" onClick={() => setAdjusting(true)}>
          Ajustar stock
        </button>
        <button className="pill-btn" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="pill-btn danger" onClick={() => setRemoving(true)}>
          Borrar
        </button>
      </div>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="kpi-card">
          <div className="kpi-label">Stock</div>
          <div className="kpi-value">
            {qty(product.stock_qty)} {product.unit}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Costo</div>
          <div className="kpi-value">{money(product.cost_price, currency)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Precio</div>
          <div className="kpi-value">{money(product.sale_price, currency)}</div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-medium">Historial de stock</h2>
        <Link className="text-sm text-[#8a5a00]" to={`/movimientos?productId=${product.id}`}>
          Ver todos los movimientos
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#dadce0]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(product.movements || []).map((row) => (
              <tr key={row.id}>
                <td>{ymd(row.created_at)}</td>
                <td>{MOVEMENT_KINDS[row.kind] || row.kind}</td>
                <td className={Number(row.qty) < 0 ? 'text-[#c5221f]' : 'text-[#137333]'}>
                  {qty(row.qty)}
                </td>
                <td>{row.notes || '—'}</td>
              </tr>
            ))}
            {!product.movements?.length && (
              <tr>
                <td className="py-8 text-center text-[#70757a]" colSpan={4}>
                  Sin movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {removing && (
        <ConfirmDangerModal
          title={`Borrar ${product.name}`}
          message={`Se va a borrar el producto ${product.name} (${product.sku}) y su historial de stock. Si está en ventas o compras, primero hay que borrar esos comprobantes.`}
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await api.deleteProduct(product.id);
            navigate('/productos');
          }}
        />
      )}
      {adjusting && (
        <StockAdjustModal
          product={product}
          onClose={() => setAdjusting(false)}
          onSave={async (body) => {
            await api.adjustStock(product.id, body);
            setAdjusting(false);
            await load();
          }}
        />
      )}
      {editing && (
        <ProductForm
          form={toProductForm(product)}
          categories={categories}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            await api.saveProduct(product.id, body);
            setEditing(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
