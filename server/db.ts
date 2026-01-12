import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { env } from "./config/env";

const sslEnabled = env.DATABASE_URL.includes("sslmode=require");

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle({ client: pool, schema });
