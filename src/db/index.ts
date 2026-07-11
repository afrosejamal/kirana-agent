import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "kirana.db");

export const db = new Database(DB_PATH);

// WAL mode = readers don't block writers, writers don't block readers.
// This is a big part of how we'll handle concurrency safely.
db.pragma("journal_mode = WAL");

// Enforce foreign key constraints (off by default in SQLite).
db.pragma("foreign_keys = ON");

export default db;