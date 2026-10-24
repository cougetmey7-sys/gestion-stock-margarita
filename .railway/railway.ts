import { defineRailway, github, group, postgres, project, service } from "railway/iac";

/**
 * Gestión de stock — plantilla Railway (monolito React + API + Postgres).
 *
 * Comandos:
 *   railway link
 *   railway config plan
 *   railway config apply
 *   railway templates create
 *   railway templates publish <id> --category Starters \
 *     --description "Stock, ventas, compras, precios masivos y CSV/Excel" \
 *     --readme-file template/marketplace.md
 */
export default defineRailway(() => {
  const db = postgres("Postgres");

  const app = service("stock", {
    source: github("ProfesIA-IA/gestion-stock", { branch: "main" }),
    build: "npm install --include=dev && npm run build",
    start: "npm start",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    env: {
      NODE_ENV: "production",
      CORS_ORIGIN: "*",
      DATABASE_URL: db.env.DATABASE_URL,
      STORE_TIMEZONE: "America/Argentina/Buenos_Aires",
      STORE_NAME: "Mi comercio",
      SEED_DEMO: "true",
      DEFAULT_ADMIN_USER: "admin",
      DEFAULT_ADMIN_PASSWORD: "${{secret(20)}}",
      UPLOAD_DIR: "/data/uploads",
    },
  });

  return project("gestion-stock", {
    resources: [group("Stock", [app, db])],
  });
});
