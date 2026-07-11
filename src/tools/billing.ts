import db from "../db";
import { findProductByName } from "./products";
import { gstBreakup, round2 } from "../lib/money";
import { khataAddCredit } from "./khata";

export function startBill(input: { customer_name?: string; payment_mode?: string }) {
  const info = db.prepare(`
    INSERT INTO bills (status, customer_name, payment_mode) VALUES ('draft', ?, ?)
  `).run(input.customer_name ?? null, input.payment_mode ?? null);
  return { bill_id: info.lastInsertRowid };
}

// Adding an item is NOT where stock is checked/decremented — that happens
// only at finalize. This lets the owner overshoot temporarily while
// building a bill, and we only enforce the hard limit at the money moment.
export const addItemToBill = db.transaction((input: {
  bill_id: number; product_name: string; qty: number;
}) => {
  const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(input.bill_id) as any;
  if (!bill) throw new Error(`No such bill ${input.bill_id}.`);
  if (bill.status !== "draft") throw new Error(`Bill ${input.bill_id} is already ${bill.status}, can't edit it.`);

  const product = findProductByName(input.product_name) as any;
  if (!product) throw new Error(`No product found matching "${input.product_name}". Never guess a price — check the catalogue.`);
  if (input.qty <= 0) throw new Error("Quantity must be positive.");

  const { base, cgst, sgst, lineGross } = gstBreakup(product.sell_price, product.gst_rate, input.qty);

  // If this product is already on the bill, replace the line (supports edits like "make it 6 Maggi")
  const existing = db.prepare(`SELECT * FROM bill_items WHERE bill_id = ? AND product_id = ?`).get(input.bill_id, product.id);
  if (existing) {
    db.prepare(`
      UPDATE bill_items SET qty=?, unit_price=?, gst_rate=?, base_amount=?, cgst_amount=?, sgst_amount=?, line_total=?
      WHERE id = ?
    `).run(input.qty, product.sell_price, product.gst_rate, base, cgst, sgst, lineGross, (existing as any).id);
  } else {
    db.prepare(`
      INSERT INTO bill_items (bill_id, product_id, qty, unit_price, gst_rate, base_amount, cgst_amount, sgst_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.bill_id, product.id, input.qty, product.sell_price, product.gst_rate, base, cgst, sgst, lineGross);
  }

  return getDraftBill({ bill_id: input.bill_id });
});

export function removeItemFromBill(input: { bill_id: number; product_name: string }) {
  const product = findProductByName(input.product_name) as any;
  if (!product) throw new Error(`No product found matching "${input.product_name}".`);
  db.prepare(`DELETE FROM bill_items WHERE bill_id = ? AND product_id = ?`).run(input.bill_id, product.id);
  return getDraftBill({ bill_id: input.bill_id });
}

export function getDraftBill(input: { bill_id: number }) {
  const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(input.bill_id);
  const items = db.prepare(`
    SELECT bi.*, p.name AS product_name, p.unit FROM bill_items bi
    JOIN products p ON p.id = bi.product_id
    WHERE bi.bill_id = ?
  `).all(input.bill_id) as any[];

  const subtotal = round2(items.reduce((s, i) => s + i.base_amount, 0));
  const totalGst = round2(items.reduce((s, i) => s + i.cgst_amount + i.sgst_amount, 0));
  const totalAmount = round2(subtotal + totalGst);

  return { bill, items, subtotal, total_gst: totalGst, total_amount: totalAmount };
}

// THE critical function: oversell guard + idempotency + atomic stock decrement,
// all inside one SQLite IMMEDIATE transaction so concurrent finalizes can't corrupt stock.
export const finalizeBill = db.transaction((input: {
  bill_id: number; idempotency_key: string; payment_mode: string; payment_ref?: string;
}) => {
  // Idempotency: if this exact key already produced a finalized bill, return it — don't redo anything.
  const already = db.prepare(`SELECT * FROM bills WHERE idempotency_key = ? AND status = 'final'`).get(input.idempotency_key);
  if (already) return { bill: already, was_duplicate: true };

  const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(input.bill_id) as any;
  if (!bill) throw new Error(`No such bill ${input.bill_id}.`);
  if (bill.status === "final") throw new Error(`Bill ${input.bill_id} is already finalized.`);

  const items = db.prepare(`SELECT * FROM bill_items WHERE bill_id = ?`).all(input.bill_id) as any[];
  if (items.length === 0) throw new Error("Can't finalize an empty bill.");

  // OVERSELL GUARD: atomic conditional update. If rowcount is 0, there wasn't enough stock —
  // we throw, which rolls back the ENTIRE transaction (nothing partially decrements).
  for (const item of items) {
    const result = db.prepare(`
      UPDATE products SET qty = qty - ?, updated_at = datetime('now')
      WHERE id = ? AND qty >= ?
    `).run(item.qty, item.product_id, item.qty);

    if (result.changes === 0) {
      const product = db.prepare(`SELECT name, qty FROM products WHERE id = ?`).get(item.product_id) as any;
      throw new Error(`Not enough stock for ${product.name}: only ${product.qty} left, tried to sell ${item.qty}.`);
    }

    db.prepare(`INSERT INTO stock_txns (product_id, change_qty, reason, ref_id) VALUES (?, ?, 'sale', ?)`)
      .run(item.product_id, -item.qty, input.bill_id);
  }

  const subtotal = round2(items.reduce((s, i) => s + i.base_amount, 0));
  const totalGst = round2(items.reduce((s, i) => s + i.cgst_amount + i.sgst_amount, 0));
  const totalAmount = round2(subtotal + totalGst);

  db.prepare(`
    UPDATE bills SET status='final', payment_mode=?, payment_ref=?, idempotency_key=?,
      subtotal=?, total_gst=?, total_amount=?, finalized_at=datetime('now')
    WHERE id = ?
  `).run(input.payment_mode, input.payment_ref ?? null, input.idempotency_key, subtotal, totalGst, totalAmount, input.bill_id);

  // If paid on credit, put it on the customer's khata as part of the SAME transaction.
  if (input.payment_mode === "credit" && bill.customer_name) {
    khataAddCredit({ customer_name: bill.customer_name, amount: totalAmount, note: `Bill #${input.bill_id}` });
  }

  const finalBill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(input.bill_id);
  return { bill: finalBill, was_duplicate: false };
});