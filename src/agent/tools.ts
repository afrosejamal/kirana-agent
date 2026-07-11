import { tool } from "ai";
import { z } from "zod";
import * as products from "../tools/products";
import * as billing from "../tools/billing";
import * as khata from "../tools/khata";
import * as reports from "../tools/reports";
import * as prefs from "../tools/preferences";
import { generateInvoicePdf } from "../documents/invoice";
import { generateAnalysisDeck } from "../documents/deck";

function safe<T>(fn: () => T) {
  try {
    return { success: true, data: fn() };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export const tools = {
  add_product: tool({
    description: "Add a brand new product/SKU to the catalogue. Fails if it already exists.",
    inputSchema: z.object({
      name: z.string(),
      unit: z.enum(["kg", "g", "litre", "ml", "packet", "dozen", "piece"]),
      hsn_code: z.string().nullish(),
      gst_rate: z.number().describe("GST percent, e.g. 0, 5, 12, 18"),
      cost_price: z.number(),
      sell_price: z.number().describe("Tax-inclusive selling price, like MRP"),
      reorder_level: z.number().nullish(),
      is_loose: z.boolean().nullish(),
    }),
    execute: async (input) => safe(() => products.addProduct(input)),
  }),

  receive_stock: tool({
    description: "Record stock received from a supplier, increasing an existing product's quantity.",
    inputSchema: z.object({
      product_name: z.string(),
      qty: z.number().positive(),
      cost_price: z.number().nullish(),
      sell_price: z.number().nullish(),
    }),
    execute: async (input) => safe(() => products.receiveStock(input)),
  }),

  get_stock_level: tool({
    description: "Check current stock for a single product.",
    inputSchema: z.object({ product_name: z.string() }),
    execute: async (input) => safe(() => products.getStockLevel(input.product_name)),
  }),

  get_low_stock: tool({
    description: "List products at or below reorder level — what's running out. Takes no real input.",
    inputSchema: z.object({
      _unused: z.string().nullish(),
    }),
    execute: async () => safe(() => products.getLowStock()),
  }),

  list_products: tool({
    description: "List the full product catalogue with prices and stock. Takes no real input.",
    inputSchema: z.object({
      _unused: z.string().nullish(),
    }),
    execute: async () => safe(() => products.listProducts()),
  }),

  start_bill: tool({
    description: "Start a new draft bill, before adding any items.",
    inputSchema: z.object({
      customer_name: z.string().nullish().describe("Only if this is a khata/credit sale"),
      payment_mode: z.enum(["cash", "upi", "card", "credit"]).nullish(),
    }),
    execute: async (input) => safe(() => billing.startBill(input)),
  }),

  add_item_to_bill: tool({
    description: "Add or update an item line on a draft bill. Re-calling with the same product replaces its quantity — use this for edits like 'make it 6 Maggi'.",
    inputSchema: z.object({
      bill_id: z.number(),
      product_name: z.string(),
      qty: z.number().positive(),
    }),
    execute: async (input) => safe(() => billing.addItemToBill(input)),
  }),

  remove_item_from_bill: tool({
    description: "Remove a product line from a draft bill, e.g. 'drop the butter'.",
    inputSchema: z.object({ bill_id: z.number(), product_name: z.string() }),
    execute: async (input) => safe(() => billing.removeItemFromBill(input)),
  }),

  get_draft_bill: tool({
    description: "Fetch a draft bill's current items, subtotal, GST, and total — use this to show the owner before finalizing.",
    inputSchema: z.object({ bill_id: z.number() }),
    execute: async (input) => safe(() => billing.getDraftBill(input)),
  }),

  finalize_bill: tool({
    description: "Finalize a draft bill: checks stock, refuses if insufficient, decrements stock, computes GST totals, records payment. Generate a fresh random idempotency_key yourself for each new finalize attempt; only reuse a key if you are deliberately retrying the exact same action.",
    inputSchema: z.object({
      bill_id: z.number(),
      idempotency_key: z.string(),
      payment_mode: z.enum(["cash", "upi", "card", "credit"]),
      payment_ref: z.string().optional(),
    }),
    execute: async (input) => safe(() => billing.finalizeBill(input)),
  }),

  khata_add_credit: tool({
    description: "Put an amount on a customer's khata (credit) account. Creates the customer if new.",
    inputSchema: z.object({ customer_name: z.string(), amount: z.number().positive(), note: z.string().nullish() }),
    execute: async (input) => safe(() => khata.khataAddCredit(input)),
  }),

  khata_record_payment: tool({
    description: "Record a khata payment/settlement. Fails if the customer has no khata account.",
    inputSchema: z.object({ customer_name: z.string(), amount: z.number().positive() }),
    execute: async (input) => safe(() => khata.khataRecordPayment(input)),
  }),

  khata_get_balance: tool({
    description: "Check a customer's current khata balance.",
    inputSchema: z.object({ customer_name: z.string() }),
    execute: async (input) => safe(() => khata.khataGetBalance(input.customer_name)),
  }),

  daily_close_summary: tool({
    description: "Get today's sales summary. Takes no real input.",
    inputSchema: z.object({
      _unused: z.string().nullish(),
    }),
    execute: async () => safe(() => reports.dailyCloseSummary()),
  }),

  set_preference: tool({
    description: "Save a standing owner preference that persists across all future chats (default payment mode, preferred brand, shop name, GSTIN, etc).",
    inputSchema: z.object({ key: z.string(), value: z.string() }),
    execute: async (input) => safe(() => prefs.setPreference(input.key, input.value)),
  }),

  get_preference: tool({
    description: "Look up one stored owner preference.",
    inputSchema: z.object({ key: z.string() }),
    execute: async (input) => safe(() => prefs.getPreference(input.key)),
  }),

  generate_invoice_pdf: tool({
    description: "Generate a GST-correct PDF invoice for a finalized bill.",
    inputSchema: z.object({
      bill_id: z.number(),
    }),
    execute: async (input) =>
      safe(() => ({
        filePath: generateInvoicePdf(input.bill_id),
      })),
  }),

  generate_analysis_deck: tool({
    description: "Generate a PPTX sales analysis deck.",
    inputSchema: z.object({
      _unused: z.string().nullish(),
    }),
    execute: async () =>
      safe(() => ({
        filePath: generateAnalysisDeck(),
      })),
  }),

};