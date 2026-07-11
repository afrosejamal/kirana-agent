import { addProduct, receiveStock, getLowStock } from "./tools/products";
import { startBill, addItemToBill, finalizeBill, getDraftBill } from "./tools/billing";
import { khataAddCredit, khataGetBalance, khataRecordPayment } from "./tools/khata";
import { dailyCloseSummary } from "./tools/reports";

// 1. Normal bill flow
const { bill_id } = startBill({ payment_mode: "upi" });
addItemToBill({ bill_id: Number(bill_id), product_name: "Maggi 70g", qty: 4 });
addItemToBill({ bill_id: Number(bill_id), product_name: "Sugar (loose)", qty: 2 });
console.log("Draft bill:", getDraftBill({ bill_id: Number(bill_id) }));

const key1 = "test-key-1";
const result1 = finalizeBill({ bill_id: Number(bill_id), idempotency_key: key1, payment_mode: "upi" });
console.log("Finalized:", result1);

// 2. Idempotency check: finalize AGAIN with same key — should NOT double-decrement
const result2 = finalizeBill({ bill_id: Number(bill_id), idempotency_key: key1, payment_mode: "upi" });
console.log("Retried finalize (should say was_duplicate: true):", result2.was_duplicate);

// 3. Oversell guard check
const { bill_id: bill2 } = startBill({ payment_mode: "cash" });
try {
  addItemToBill({ bill_id: Number(bill2), product_name: "Amul Butter 100g", qty: 9999 });
  finalizeBill({ bill_id: Number(bill2), idempotency_key: "test-key-2", payment_mode: "cash" });
  console.log("❌ Oversell guard FAILED — this should not print");
} catch (e: any) {
  console.log("✅ Oversell guard worked:", e.message);
}

// 4. Khata cycle
khataAddCredit({ customer_name: "Ramesh", amount: 500 });
console.log("Ramesh balance after credit:", khataGetBalance("Ramesh"));
khataRecordPayment({ customer_name: "Ramesh", amount: 300 });
console.log("Ramesh balance after payment:", khataGetBalance("Ramesh"));

// 5. Khata guardrail check
try {
  khataRecordPayment({ customer_name: "NoSuchPerson", amount: 100 });
  console.log("❌ Khata guardrail FAILED");
} catch (e: any) {
  console.log("✅ Khata guardrail worked:", e.message);
}

console.log("Low stock:", getLowStock());
console.log("Daily close:", dailyCloseSummary());