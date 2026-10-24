# Deploy and Host Gestión de stock on Railway

Stock, ventas a clientes y compras a proveedores: catálogo con SKU, cuenta corriente, ajustes masivos de precio, historial de pagos e importación/exportación CSV y Excel. Un clic despliega la app y PostgreSQL. Un solo servicio sirve la interfaz y la API.

## About Hosting Gestión de stock

El stack es un monolito: React + Express en el servicio **stock**, con PostgreSQL para productos, clientes, proveedores, comprobantes y pagos. Railway genera el dominio HTTPS, la password de administración y conecta `DATABASE_URL` al plugin de Postgres.

El arranque corre migraciones y, si la base está vacía, puede cargar datos de ejemplo (`SEED_DEMO=true`).

## Why Deploy Gestión de stock

- Subí un comercio a producción sin armar servidores ni Nginx.
- Postgres administrado y HTTPS listos, con healthcheck en `/health`.
- Ventas y compras que mueven stock al confirmar, con cobros y pagos parciales.
- Precios masivos y carga de catálogo por CSV/Excel.

## Common Use Cases

- Almacenes, kioscos y depósitos que venden y reponen mercadería
- Equipos que necesitan cuenta corriente de clientes y proveedores
- Actualizar listas de precios de un golpe (porcentaje o importe)
- Migrar un Excel de productos, clientes o proveedores

## Dependencies for Gestión de stock Hosting

### Deployment Dependencies

| Servicio | Propósito |
| --- | --- |
| **stock** | UI React + API Express (inventario, ventas, compras, pagos, CSV/Excel) |
| **Postgres** | Persistencia de usuarios, productos, comprobantes y pagos |

### Después del deploy

1. Generá un **dominio público** para el servicio **stock**.
2. En Variables copiá `DEFAULT_ADMIN_PASSWORD`.
3. Entrá con usuario `admin` y esa contraseña.
4. Revisá el catálogo demo o importá tu CSV/Excel desde **CSV / Excel**.

Zona horaria por defecto: `America/Argentina/Buenos_Aires`. Cambiala en **Configuración** si hace falta.

Para dejar de cargar datos de demostración, poné `SEED_DEMO=false` (solo afecta bases vacías).

### Fuente

GitHub: `ProfesIA-IA/gestion-stock`  
IaC: `.railway/railway.ts`
