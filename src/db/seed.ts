import db from "./index";

const products = [
  ["Aashirvaad Atta 5kg", "packet", "1101", 5, 210, 250, 40, 10, 0],
  ["Tata Salt 1kg", "packet", "2501", 5, 18, 25, 60, 15, 0],
  ["Amul Butter 100g", "packet", "0405", 12, 48, 62, 30, 10, 0],
  ["Fortune Sunflower Oil 1L", "packet", "1512", 5, 118, 145, 25, 8, 0],
  ["Maggi 70g", "packet", "1902", 18, 10, 14, 100, 20, 0],
  ["Parle-G", "packet", "1905", 18, 8, 10, 100, 20, 0],
  ["Surf Excel 1kg", "packet", "3402", 18, 95, 130, 20, 5, 0],
  ["Sugar (loose)", "kg", "1701", 0, 38, 45, 50, 10, 1],
  ["Rice (loose)", "kg", "1006", 0, 32, 40, 80, 15, 1],
  ["Toor Dal (loose)", "kg", "0713", 0, 95, 120, 40, 10, 1],
];

const count = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get() as { count: number };

if (count.count === 0) {
  const insert = db.prepare(`
    INSERT INTO products
    (name, unit, hsn_code, gst_rate, cost_price, sell_price, qty, reorder_level, is_loose)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      insert.run(...row);
    }
  });

  insertMany(products);

  console.log(`✅ Seeded ${products.length} products.`);
} else {
  console.log("ℹ️ Products already exist. Skipping seed.");
}