import { defineConfig } from "drizzle-kit";

// Conexión directa a PostgreSQL (Supabase > Project Settings > Database > Connection string).
// Solo se usa para herramientas de migración locales; no se incluye en la aplicación.
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
