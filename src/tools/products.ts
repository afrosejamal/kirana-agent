import db from "../db";

export function findProductByName(name: string) {
  // simple fuzzy match: exact first, then partial
  const exact = db.prepare(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`).get(name);
  if (exact) return exact;
  return db.prepare(`SELECT * FROM products WHERE LOWER(name) LIKE LOWER(?)`).get(`%${name}%`);
}

export function listProducts() {
  return db.prepare(`SELECT * FROM products ORDER BY name`).all();
}

export function addProduct(input: {
  name: string; unit: string; hsn_code?: string; gst_rate: number;
  cost_price: number; sell_price: number; reorder_level?: number; is_loose?: boolean;
}) {
  const existing = findProductByName(input.name);
  if (existing) throw new Error(`Product "${input.name}" already exists (id ${(existing as any).id}). Use receive_stock to add quantity instead.`);

  const stmt = db.prepare(`
    INSERT INTO products (name, unit, hsn_code, gst_rate, cost_price, sell_price, qty, reorder_level, is_loose)
    VALUES (@name, @unit, @hsn_code, @gst_rate, @cost_price, @sell_price, 0, @reorder_level, @is_loose)
  `);
  const info = stmt.run({
    name: input.name,
    unit: input.unit,
    hsn_code: input.hsn_code ?? null,
    gst_rate: input.gst_rate,
    cost_price: input.cost_price,
    sell_price: input.sell_price,
    reorder_level: input.reorder_level ?? 0,
    is_loose: input.is_loose ? 1 : 0,
  });
  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(info.lastInsertRowid);
}

// Atomic: increases stock and logs the movement in one transaction.
export const receiveStock = db.transaction((input: {
  product_name: string; qty: number; cost_price?: number; sell_price?: number;
}) => {
  const product = findProductByName(input.product_name) as any;
  if (!product) throw new Error(`No product found matching "${input.product_name}". Add it first with add_product.`);
  if (input.qty <= 0) throw new Error("Quantity received must be positive.");

  db.prepare(`
    UPDATE products
    SET qty = qty + @qty,
        cost_price = COALESCE(@cost_price, cost_price),
        sell_price = COALESCE(@sell_price, sell_price),
        updated_at = datetime('now')
    WHERE id = @id
  `).run({ id: product.id, qty: input.qty, cost_price: input.cost_price ?? null, sell_price: input.sell_price ?? null });

  db.prepare(`
    INSERT INTO stock_txns (product_id, change_qty, reason) VALUES (?, ?, 'receive')
  `).run(product.id, input.qty);

  return db.prepare(`SELECT * FROM products WHERE id = ?`).get(product.id);
});

export function getStockLevel(productName: string) {
  const product = findProductByName(productName);
  if (!product) throw new Error(`No product found matching "${productName}".`);
  return product;
}

export function getLowStock() {
  return db.prepare(`SELECT * FROM products WHERE qty <= reorder_level ORDER BY qty ASC`).all();
}