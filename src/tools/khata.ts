import db from "../db";

function findCustomer(name: string) {
  return db.prepare(`SELECT * FROM khata_customers WHERE LOWER(name) = LOWER(?)`).get(name);
}

export const khataAddCredit = db.transaction((input: { customer_name: string; amount: number; note?: string }) => {
  if (input.amount <= 0) throw new Error("Credit amount must be positive.");
  let customer = findCustomer(input.customer_name) as any;
  if (!customer) {
    const info = db.prepare(`INSERT INTO khata_customers (name, balance) VALUES (?, 0)`).run(input.customer_name);
    customer = { id: info.lastInsertRowid, name: input.customer_name, balance: 0 };
  }
  db.prepare(`UPDATE khata_customers SET balance = balance + ? WHERE id = ?`).run(input.amount, customer.id);
  db.prepare(`INSERT INTO khata_txns (customer_id, type, amount, note) VALUES (?, 'credit', ?, ?)`)
    .run(customer.id, input.amount, input.note ?? null);
  return db.prepare(`SELECT * FROM khata_customers WHERE id = ?`).get(customer.id);
});

export const khataRecordPayment = db.transaction((input: { customer_name: string; amount: number }) => {
  if (input.amount <= 0) throw new Error("Payment amount must be positive.");
  const customer = findCustomer(input.customer_name) as any;
  // GUARDRAIL: refuse to settle khata for a customer that doesn't exist.
  if (!customer) throw new Error(`No khata account exists for "${input.customer_name}". Nothing to settle.`);

  db.prepare(`UPDATE khata_customers SET balance = balance - ? WHERE id = ?`).run(input.amount, customer.id);
  db.prepare(`INSERT INTO khata_txns (customer_id, type, amount) VALUES (?, 'payment', ?)`).run(customer.id, input.amount);
  return db.prepare(`SELECT * FROM khata_customers WHERE id = ?`).get(customer.id);
});

export function khataGetBalance(customerName: string) {
  const customer = findCustomer(customerName);
  if (!customer) throw new Error(`No khata account exists for "${customerName}".`);
  return customer;
}