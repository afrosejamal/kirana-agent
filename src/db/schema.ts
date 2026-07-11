import db from "./index";

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,              -- kg | g | litre | ml | packet | dozen | piece
  hsn_code TEXT,
  gst_rate REAL NOT NULL DEFAULT 0, -- e.g. 5, 12, 18 (percent)
  cost_price REAL NOT NULL,
  sell_price REAL NOT NULL,         -- tax-inclusive, like a real MRP
  qty REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  is_loose INTEGER NOT NULL DEFAULT 0, -- 0 = packaged, 1 = loose (sugar/rice/dal by kg)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | final | cancelled
  customer_name TEXT,
  payment_mode TEXT,                     -- cash | upi | card | credit
  payment_ref TEXT,
  idempotency_key TEXT UNIQUE,
  subtotal REAL NOT NULL DEFAULT 0,
  total_gst REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty REAL NOT NULL,
  unit_price REAL NOT NULL,   -- snapshot at billing time
  gst_rate REAL NOT NULL,     -- snapshot at billing time
  base_amount REAL NOT NULL,
  cgst_amount REAL NOT NULL,
  sgst_amount REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS khata_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  balance REAL NOT NULL DEFAULT 0,  -- positive = customer owes the shop
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS khata_txns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES khata_customers(id),
  type TEXT NOT NULL,   -- credit | payment
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_txns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  change_qty REAL NOT NULL,  -- positive = stock in, negative = sale
  reason TEXT NOT NULL,      -- receive | sale | adjustment
  ref_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

console.log("✅ Schema created successfully at kirana.db");