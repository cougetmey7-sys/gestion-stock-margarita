# Gestión de stock — plantilla Railway

Publicado: [railway.com/deploy/gestion-stock](https://railway.com/deploy/gestion-stock)

Un clic para desplegar stock, ventas y compras (UI React + API + Postgres):

| Servicio | Rol |
|---|---|
| **stock** | Monolito React + Express (productos, clientes, proveedores, ventas, compras, pagos, CSV/Excel) |
| **Postgres** | Base de datos |

```text
Navegador  →  Stock (React + API)  →  Postgres
```

## Checklist marketplace

- [x] Secrets con `${{secret()}}` (password de admin)
- [x] `DATABASE_URL` referenciada a Postgres
- [x] Healthcheck `/health`
- [x] Seed demo opcional (`SEED_DEMO=true`)
- [x] Zona horaria Argentina por defecto

## Opción A — IaC

```bash
railway link
railway config plan
railway config apply
```

En el dashboard:

1. Generá un **dominio público** para `stock`.
2. Copiá `DEFAULT_ADMIN_PASSWORD` → login (`admin` + esa password).
3. Abrí Inicio, Productos y una venta de ejemplo.

## Opción B — Marketplace

Cuenta verificada de Railway. Desde un proyecto que ya coincida con este stack:

```bash
railway templates create --project gestion-stock --environment production --json
railway templates publish <template-id> \
  --category Starters \
  --description "Stock, ventas, compras, precios masivos y CSV/Excel" \
  --readme-file template/marketplace.md \
  --json
```

Categorías válidas de la CLI: `AI/ML`, `Analytics`, `Authentication`, `Automation`, `Blogs`, `Bots`, `CMS`, `Observability`, `Other`, `Starters`, `Storage`, `Queues`.

Para actualizar el texto público después del primer publish:

```bash
railway templates update <template-id> \
  --category Starters \
  --description "Stock, ventas, compras, precios masivos y CSV/Excel" \
  --readme-file template/marketplace.md \
  --json
```

## Opción C — Manual

1. Proyecto nuevo.
2. **+ Database → PostgreSQL** (nombre: `Postgres`)
3. **+ GitHub Repo** → este repo (nombre: `stock`)
4. Variables: ver `.railway/railway.ts`
5. Dominio HTTPS → redeploy.

## Post-deploy

- [ ] El servicio tiene dominio HTTPS
- [ ] `/health` responde `{ ok: true }`
- [ ] Login con la password generada
- [ ] Se ven productos y una venta demo
- [ ] Confirmar una venta descuenta stock
- [ ] Importar un CSV de productos funciona
