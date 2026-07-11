import db from "../db";

export function dailyCloseSummary() {
  const bills = db.prepare(`
    SELECT * FROM bills WHERE status = 'final' AND date(finalized_at) = date('now')
  `).all() as any[];

  const totalAmount = bills.reduce((s, b) => s + b.total_amount, 0);
  const totalGst = bills.reduce((s, b) => s + b.total_gst, 0);

  const byMode: Record<string, number> = {};
  for (const b of bills) byMode[b.payment_mode] = (byMode[b.payment_mode] ?? 0) + b.total_amount;

  const topItems = db.prepare(`
    SELECT p.name, SUM(bi.qty) as total_qty, SUM(bi.line_total) as total_revenue
    FROM bill_items bi
    JOIN bills b ON b.id = bi.bill_id
    JOIN products p ON p.id = bi.product_id
    WHERE b.status = 'final' AND date(b.finalized_at) = date('now')
    GROUP BY p.id ORDER BY total_qty DESC LIMIT 5
  `).all();

  return { bill_count: bills.length, total_amount: totalAmount, total_gst: totalGst, by_payment_mode: byMode, top_items: topItems };
}