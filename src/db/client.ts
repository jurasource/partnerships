import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./data/app.db";

// Ensure the data directory exists before opening the file
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
