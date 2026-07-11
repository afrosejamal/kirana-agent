import "dotenv/config";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

async function main() {
  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: "Say hello and confirm you're working, in one short sentence.",
  });

  console.log(text);
}

main();