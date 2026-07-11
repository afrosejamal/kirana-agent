import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import db from "../db";
import { getAllPreferences } from "../tools/preferences";

export function generateInvoicePdf(billId: number): string {
  const bill = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId) as any;
  if (!bill) throw new Error(`No such bill ${billId}.`);
  if (bill.status !== "final") throw new Error(`Bill ${billId} isn't finalized yet — finalize it first.`);

  const items = db.prepare(`
    SELECT bi.*, p.name AS product_name, p.unit, p.hsn_code FROM bill_items bi
    JOIN products p ON p.id = bi.product_id
    WHERE bi.bill_id = ?
  `).all(billId) as any[];

  const prefs = getAllPreferences();
  const shopName = prefs.shop_name || "Kirana Store";
  const gstin = prefs.gstin || "GSTIN not set";

  const outDir = path.join(process.cwd(), "generated");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const filePath = path.join(outDir, `invoice-${billId}.pdf`);

  const doc = new PDFDocument({ margin: 40, size: "A5" });
  doc.pipe(fs.createWriteStream(filePath));

  // Header
  doc.fontSize(16).text(shopName, { align: "center" });
  doc.fontSize(9).text(`GSTIN: ${gstin}`, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Invoice #${bill.id}`, { align: "center" });
  doc.fontSize(9).text(`Date: ${bill.finalized_at}`, { align: "center" });
  doc.fontSize(9).text(`Payment: ${bill.payment_mode.toUpperCase()}${bill.customer_name ? " | Customer: " + bill.customer_name : ""}`, { align: "center" });
  doc.moveDown(1);

  // Table header
  const startX = 40;
  let y = doc.y;
  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Item", startX, y, { width: 130 });
  doc.text("HSN", startX + 130, y, { width: 50 });
  doc.text("Qty", startX + 180, y, { width: 35 });
  doc.text("Base", startX + 215, y, { width: 45 });
  doc.text("CGST", startX + 260, y, { width: 40 });
  doc.text("SGST", startX + 300, y, { width: 40 });
  doc.text("Total", startX + 340, y, { width: 45 });
  doc.moveDown(0.3);
  doc.moveTo(startX, doc.y).lineTo(400, doc.y).stroke();
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(8);

  for (const item of items) {
    y = doc.y;
    doc.text(item.product_name, startX, y, { width: 130 });
    doc.text(item.hsn_code || "-", startX + 130, y, { width: 50 });
    doc.text(String(item.qty), startX + 180, y, { width: 35 });
    doc.text(item.base_amount.toFixed(2), startX + 215, y, { width: 45 });
    doc.text(item.cgst_amount.toFixed(2), startX + 260, y, { width: 40 });
    doc.text(item.sgst_amount.toFixed(2), startX + 300, y, { width: 40 });
    doc.text(item.line_total.toFixed(2), startX + 340, y, { width: 45 });
    doc.moveDown(0.4);
  }

  doc.moveTo(startX, doc.y).lineTo(400, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold");
  doc.text(`Subtotal: ₹${bill.subtotal.toFixed(2)}`, { align: "right" });
  doc.text(`Total GST: ₹${bill.total_gst.toFixed(2)}`, { align: "right" });
  doc.fontSize(11).text(`Grand Total: ₹${bill.total_amount.toFixed(2)}`, { align: "right" });

  doc.end();
  return filePath;
}