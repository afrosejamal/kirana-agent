import db from "./index";

const rows = db.prepare("SELECT id, name, gst_rate, sell_price, qty FROM products").all();
console.table(rows);