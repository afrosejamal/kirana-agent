import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import db from "../db";
import { dailyCloseSummary } from "../tools/reports";

export function generateAnalysisDeck(): string {
  const summary = dailyCloseSummary();

  const salesLast7Days = db.prepare(`
    SELECT date(finalized_at) as day, SUM(total_amount) as total
    FROM bills WHERE status='final' AND finalized_at >= datetime('now','-7 days')
    GROUP BY day ORDER BY day
  `).all() as any[];

  const topItems = db.prepare(`
    SELECT p.name, SUM(bi.qty) as qty
    FROM bill_items bi JOIN bills b ON b.id=bi.bill_id JOIN products p ON p.id=bi.product_id
    WHERE b.status='final' AND b.finalized_at >= datetime('now','-7 days')
    GROUP BY p.id ORDER BY qty DESC LIMIT 5
  `).all() as any[];

  const lowStock = db.prepare(`SELECT name, qty, reorder_level FROM products WHERE qty <= reorder_level`).all() as any[];

  const pptx = new PptxGenJS();

  // Slide 1: Title
  const s1 = pptx.addSlide();
  s1.addText("Weekly Sales Analysis", { x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 32, bold: true, align: "center" });
  s1.addText(new Date().toLocaleDateString(), { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 14, align: "center" });

  // Slide 2: Sales trend (line chart)
  const s2 = pptx.addSlide();
  s2.addText("Sales Trend (Last 7 Days)", { x: 0.3, y: 0.2, fontSize: 20, bold: true });
  s2.addChart(pptx.ChartType.line, [
    { name: "Sales (₹)", labels: salesLast7Days.map(r => r.day), values: salesLast7Days.map(r => r.total) },
  ], { x: 0.5, y: 1, w: 9, h: 4.5 });

  // Slide 3: Top items (bar chart)
  const s3 = pptx.addSlide();
  s3.addText("Top Selling Items", { x: 0.3, y: 0.2, fontSize: 20, bold: true });
  s3.addChart(pptx.ChartType.bar, [
    { name: "Qty Sold", labels: topItems.map(r => r.name), values: topItems.map(r => r.qty) },
  ], { x: 0.5, y: 1, w: 9, h: 4.5 });

  // Slide 4: Today's summary + tax
  const s4 = pptx.addSlide();
  s4.addText("Today's Snapshot", { x: 0.3, y: 0.2, fontSize: 20, bold: true });
  s4.addText(
    `Bills: ${summary.bill_count}\nTotal Sales: ₹${summary.total_amount.toFixed(2)}\nGST Collected: ₹${summary.total_gst.toFixed(2)}\n` +
    Object.entries(summary.by_payment_mode).map(([k, v]) => `${k.toUpperCase()}: ₹${(v as number).toFixed(2)}`).join("\n"),
    { x: 0.5, y: 1.2, w: 9, h: 3, fontSize: 16 }
  );

  // Slide 5: Stock health
  const s5 = pptx.addSlide();
  s5.addText("Stock Health — Reorder Needed", { x: 0.3, y: 0.2, fontSize: 20, bold: true });
  if (lowStock.length > 0) {
    s5.addTable(
      [["Product", "Current Qty", "Reorder Level"], ...lowStock.map(r => [r.name, String(r.qty), String(r.reorder_level)])],
      { x: 0.5, y: 1, w: 9, fontSize: 12 }
    );
  } else {
    s5.addText("All stock levels healthy.", { x: 0.5, y: 1.5, fontSize: 16 });
  }

  const outDir = path.join(process.cwd(), "generated");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const filePath = path.join(outDir, `analysis-deck-${Date.now()}.pptx`);
  pptx.writeFile({ fileName: filePath });

  return filePath;
}