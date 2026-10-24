import { NavLink, Outlet } from 'react-router-dom';
import {
  Boxes,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Percent,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import PoweredBy from './PoweredBy';
import { BRAND } from '../brand';
import Sitemap from './Sitemap';

export const NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/productos', label: 'Productos', icon: Boxes },
  { to: '/movimientos', label: 'Movimientos', icon: History },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/proveedores', label: 'Proveedores', icon: Truck },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/compras', label: 'Compras', icon: PackagePlus },
  { to: '/pagos', label: 'Pagos', icon: Wallet },
  { to: '/precios', label: 'Precios', icon: Percent },
  { to: '/importar', label: 'CSV / Excel', icon: FileSpreadsheet },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex min-h-14 items-center gap-1 border-b-4 border-[#f5c518] px-2 sm:min-h-16">
        <button className="icon-btn lg:hidden" type="button" onClick={() => setOpen(true)} aria-label="Menú">
          <Menu size={22} />
        </button>
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <img src={BRAND.logo} alt={BRAND.name} className="h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-[#1c1c1c] sm:text-xl">
              {settings?.name || BRAND.name}
            </div>
            <div className="hidden truncate text-xs text-[#70757a] sm:block">Gestión de stock</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-[#70757a] sm:block">{user?.name || user?.username}</span>
          <button className="icon-btn" type="button" onClick={logout} title="Salir">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <Sitemap />
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <aside
            className="absolute bottom-0 left-0 top-0 w-[min(320px,90vw)] overflow-auto bg-white p-4 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium">Menú</div>
              <button className="icon-btn" type="button" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <Nav onPick={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[240px] shrink-0 overflow-auto border-r border-[#dadce0] py-3 lg:block">
          <Nav />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <PoweredBy />
    </div>
  );
}

function Nav({ onPick }) {
  return (
    <nav>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          onClick={onPick}
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
