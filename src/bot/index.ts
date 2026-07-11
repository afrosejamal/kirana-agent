import "dotenv/config";

import "../db/schema";
import "../db/seed";

import { Telegraf } from "telegraf";
import db from "../db";
import { runAgentTurn, resetSession } from "../agent";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Telegram redelivery guard: skip an update_id we've already handled.
function alreadyProcessed(updateId: number): boolean {
  const row = db.prepare(`SELECT 1 FROM processed_updates WHERE update_id = ?`).get(updateId);
  if (row) return true;
  db.prepare(`INSERT INTO processed_updates (update_id) VALUES (?)`).run(updateId);
  return false;
}

bot.command("new", (ctx) => {
  resetSession(ctx.chat.id);
  ctx.reply("Started a fresh chat. I still remember your preferences and the store's data.");
});

bot.on("text", async (ctx) => {
  if (alreadyProcessed(ctx.update.update_id)) return;
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  try {
    await ctx.sendChatAction("typing");
    const { reply, files } = await runAgentTurn(ctx.chat.id, text);

    await ctx.reply(reply);

    for (const filePath of files) {
      await ctx.replyWithDocument({
        source: filePath,
      });
    }
    
  } catch (err: any) {
    console.error(err);
    await ctx.reply("Something went wrong on my end — try again?");
  }
});

bot.launch();
console.log("🤖 Kirana bot is running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));