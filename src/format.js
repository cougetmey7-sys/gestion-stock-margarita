export function money(value, currency = 'ARS') {
  return Number(value || 0).toLocaleString('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

export function qty(value) {
  return Number(value || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

export function ymd(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function ymdt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ymd(value);
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export const METHODS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  check: 'Cheque',
  other: 'Otro',
};

export const STATUSES = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

export const MOVEMENT_KINDS = {
  sale: 'Venta',
  purchase: 'Compra',
  manual: 'Modificación manual',
  adjustment: 'Ajuste',
  import: 'Importación',
};

export function today() {
  return new Date().toISOString().slice(0, 10);
}
