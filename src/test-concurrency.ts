import { startBill, addItemToBill, finalizeBill } from "./tools/billing";
import { receiveStock } from "./tools/products";
import db from "./db";

async function main() {
  const before = db.prepare(`SELECT qty FROM products WHERE name = 'Parle-G'`).get() as any;
  console.log("Stock before:", before.qty);

  // Fire two finalize attempts AND one stock-in, all "simultaneously"
  const b1 = startBill({ payment_mode: "cash" });
  addItemToBill({ bill_id: Number(b1.bill_id), product_name: "Parle-G", qty: 10 });

  const b2 = startBill({ payment_mode: "cash" });
  addItemToBill({ bill_id: Number(b2.bill_id), product_name: "Parle-G", qty: 10 });

  const tasks = [
    () => finalizeBill({ bill_id: Number(b1.bill_id), idempotency_key: "conc-1", payment_mode: "cash" }),
    () => finalizeBill({ bill_id: Number(b2.bill_id), idempotency_key: "conc-2", payment_mode: "cash" }),
    () => receiveStock({ product_name: "Parle-G", qty: 50 }),
  ];

  // Run them "at once" via Promise.all wrapping sync calls in microtasks
  const results = await Promise.all(tasks.map(t => Promise.resolve().then(t)));
  console.log("Results:", results.map(r => "bill" in r ? r.bill?.status ?? "stock-in" : r));

  const after = db.prepare(`SELECT qty FROM products WHERE name = 'Parle-G'`).get() as any;
  console.log("Stock after:", after.qty);
  console.log("Expected: before - 10 - 10 + 50 =", before.qty - 10 - 10 + 50);
  console.log(after.qty === before.qty - 10 - 10 + 50 ? "✅ CONCURRENCY SAFE" : "❌ STOCK CORRUPTED");
}

main();