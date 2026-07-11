# 🛒 Supermarket Ops Agent — AI-Powered Kirana Store Assistant

<p align="center">
  <b>An intelligent Telegram-based supermarket operations agent powered by Google Gemini 2.5 Flash</b>
</p>

<p align="center">
  Inventory Management • AI Billing • GST Calculation • Customer Khata • Business Memory
</p>


## 🚀 Live Telegram Bot

**Telegram:** `@kirana_super_bot`

The Supermarket Ops Agent is an AI-powered assistant designed for small and medium-sized kirana stores.

Store owners can interact with the system naturally through Telegram to manage:

- 📦 Inventory and stock
- 🧾 GST-compliant billing
- 💰 Customer credit (Khata)
- 📊 Business reports
- 🧠 Persistent store preferences


Instead of using traditional menus, the owner simply communicates with the bot like a human assistant.

Example:

> "Make a bill for 2kg sugar, 4 Maggi packets and Aashirvaad atta. Customer paying through UPI."

The AI understands the request, selects the required tools, performs database operations, and returns the result.


---

# 🏗️ System Architecture

```
                    Telegram User
                         |
                         |
                         ↓

                 Telegraf Telegram Bot

                         |
                         |
                         ↓

              Vercel AI SDK Agent Layer

                         |
                         |
                         ↓

              Google Gemini 2.5 Flash

                         |
                         |
                         ↓

                 Tool Execution Layer

                         |
                         |
                         ↓

                    SQLite Database
```

The system follows an agentic workflow:

```
User Request
      ↓
Understand Intent
      ↓
Select Tool
      ↓
Execute Business Operation
      ↓
Observe Result
      ↓
Generate Final Response
```

This is a real AI agent architecture, not a rule-based chatbot.


---

# 🧠 AI Agent Implementation

## AI Framework

Built using:

- **Vercel AI SDK**
- **Google Gemini 2.5 Flash**
- **Telegraf**
- **TypeScript**

Gemini is integrated through the AI SDK provider:

```typescript
import { google } from "@ai-sdk/google";

const result = await generateText({
    model: google("gemini-2.5-flash"),
    system: buildSystemPrompt(),
    messages: session.history,
    stopWhen: stepCountIs(8)
});
```

The model is responsible for:

✅ Understanding user intent  
✅ Selecting the correct business tool  
✅ Managing multi-step workflows  


The model does **not** store or calculate business data.

All business truth comes from the database through tools.


---

# 🔧 Agent Tool Architecture

The application follows a modular tool-based architecture.

Each business capability is isolated into its own domain.


## 📦 Product Management

`src/tools/products.ts`

Available tools:

| Tool | Purpose |
|-|-|
| `add_product` | Add new products |
| `receive_stock` | Increase inventory |
| `get_stock_level` | Check availability |
| `get_low_stock` | Find products needing reorder |
| `list_products` | View catalog |


---

## 🧾 Billing Engine

`src/tools/billing.ts`

Available tools:

| Tool | Purpose |
|-|-|
| `start_bill` | Create draft bill |
| `add_item_to_bill` | Add products |
| `remove_item_from_bill` | Edit bill |
| `get_draft_bill` | View current bill |
| `finalize_bill` | Complete purchase |


Features:

- Multi-turn billing
- Draft bill editing
- GST calculation
- Stock deduction after confirmation


---

## 💰 Customer Khata System

`src/tools/khata.ts`

Features:

- Add customer credit
- Record payments
- Check outstanding balance
- Maintain transaction history


Example:

```
User:
Put ₹500 on Ramesh's credit


Bot:
Done. Ramesh's balance has been updated.
```


---

## 📊 Reports

`src/tools/reports.ts`

Provides:

- Daily sales summary
- Revenue information
- Business insights


---

## 🧠 Persistent Store Memory

`src/tools/preferences.ts`

Stores long-term business preferences.

Memory survives:

- `/new`
- Conversation reset
- Application restart


---

# 🗄️ Database Design

Database:

- SQLite
- better-sqlite3
- WAL mode


Tables:

```
products
 |
 ├── inventory information
 ├── pricing
 └── GST details


bills
 |
 └── bill_items


khata_customers
 |
 └── khata_txns


preferences

stock_txns
```

SQLite acts as the single source of truth.

The AI model never invents:

- Prices
- Stock quantity
- GST values
- Customer balances


---

# 🔐 Reliability & Business Safety

## Inventory Protection

Stock is updated only after bill finalization.

The system prevents overselling using database transactions.

Example:

```sql
UPDATE products
SET qty = qty - requested_qty
WHERE qty >= requested_qty;
```

If stock is insufficient:

- Transaction fails
- No partial updates happen
- Inventory remains consistent


---

## GST-Compliant Billing

The billing engine supports:

- Tax-inclusive pricing
- GST back calculation
- CGST / SGST split
- HSN code support
- Two decimal rounding


GST calculations happen inside backend tools, not through AI reasoning.


---

## Transaction Safety

All critical operations use database transactions:

- Billing finalization
- Stock updates
- Khata updates


This prevents inconsistent business data.


---

## Idempotency Protection

Billing uses unique idempotency keys.

If the same request is repeated:

- Existing result is returned
- Duplicate stock deduction is prevented

---

# 🔄 Conversation Memory Example


```
User:
put ₹500 on Ramesh's credit


Bot:
Done. Ramesh's balance is ₹700.


User:
/new


User:
what's on Ramesh's khata?


Bot:
Ramesh currently owes ₹700.
```

The information survives because it is stored in SQLite, not only in chat history.


---

# 🛠️ Tech Stack

| Category | Technology |
|-|-|
| AI Model | Google Gemini 2.5 Flash |
| Agent Framework | Vercel AI SDK |
| Telegram Framework | Telegraf |
| Language | TypeScript |
| Runtime | Node.js |
| Database | SQLite |
| Database Driver | better-sqlite3 |
| Deployment | Oracle Cloud VM + PM2 |


---

# 📂 Project Structure

```
kirana-agent/

src/

├── agent/
│   ├── index.ts
│   ├── tools.ts
│   └── system-prompt.ts

├── bot/
│   └── index.ts

├── db/
│   ├── index.ts
│   └── schema.ts

├── tools/
│   ├── products.ts
│   ├── billing.ts
│   ├── khata.ts
│   ├── reports.ts
│   └── preferences.ts

├── lib/
│   └── money.ts

└── test-tools.ts
```


---

# ▶️ Running Locally

Install dependencies:

```bash
npm install
```


Create database:

```bash
npm run db:schema
```


Seed products:

```bash
npm run db:seed
```


Start Telegram bot:

```bash
npm start
```


Expected output:

```
🤖 Kirana bot is running...
```


---

# ⭐ Key Engineering Highlights

✅ Gemini-powered AI agent  
✅ Tool calling architecture  
✅ Database-grounded responses  
✅ GST-aware billing engine  
✅ Inventory safety controls  
✅ Persistent business memory  
✅ Telegram conversational interface  
✅ Production-style backend design  


---

# 👨‍💻 Author: AFROSE FATHIMA J

Built as an AI engineering project demonstrating:

- Agent design
- LLM tool usage
- Business automation
- Reliable backend systems
