export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// sell_price is TAX-INCLUSIVE (like a real MRP).
// We back-calculate the base price and split GST into CGST+SGST.
export function gstBreakup(sellPrice: number, gstRate: number, qty: number) {
  const lineGross = round2(sellPrice * qty);
  const base = round2(lineGross / (1 + gstRate / 100));
  const gstAmount = round2(lineGross - base);
  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst); // avoids rounding drift
  return { lineGross, base, gstAmount, cgst, sgst };
}