import { generateText, stepCountIs, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { tools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";

type Session = { history: ModelMessage[] };
const sessions = new Map<number, Session>();

export function resetSession(chatId: number) {
  sessions.set(chatId, { history: [] });
}

export async function runAgentTurn(
  chatId: number,
  userText: string
): Promise<{ reply: string; files: string[] }> {

  let session = sessions.get(chatId);

  if (!session) {
    session = { history: [] };
    sessions.set(chatId, session);
  }

  // Save current history so we can roll back if the turn fails
  const snapshot = [...session.history];

  // Add the user's message
  session.history.push({
    role: "user",
    content: userText,
  });

  try {
    console.log("========== HISTORY ==========");
    console.dir(session.history, { depth: null });

    console.log("========== PROMPT ==========");
    console.log(buildSystemPrompt());

    const result = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: buildSystemPrompt(),
      messages: session.history,
      tools,
      stopWhen: stepCountIs(8), // allows chaining up to 8 tool calls in one turn
    });

    // Only save assistant/tool messages if generation succeeded
    session.history.push(...result.response.messages);

    // -----------------------------
    // NEW: Collect generated files
    // -----------------------------
    const files: string[] = [];

    for (const step of result.steps) {
      for (const item of step.content) {
        if (
          item.type === "tool-result" &&
          (
            item.toolName === "generate_invoice_pdf" ||
            item.toolName === "generate_analysis_deck"
          )
        ) {
          const output = (item as any).output;

          if (output?.success && output.data?.filePath) {
            files.push(output.data.filePath);
          }
        }
      }
    }

    console.log("========== AGENT RESULT ==========");
    console.dir(result, { depth: null });

    return {
      reply: result.text || "I couldn't generate a reply.",
      files,
    };

  } catch (err) {
    // Roll back history so we don't leave a dangling user turn
    session.history = snapshot;

    console.error("========== AGENT ERROR ==========");
    console.error(err);

    throw err;
  }
}