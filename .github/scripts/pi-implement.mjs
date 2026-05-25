/**
 * Minimal pi bridge for GitHub Actions.
 *
 * Required env vars:
 *   PI_PROVIDER        LLM provider (e.g. anthropic, openai, groq)
 *   PI_API_KEY         API key for the provider
 *
 * Optional env vars:
 *   PI_MODEL           Model ID/pattern (e.g. claude-sonnet-4-20250514)
 *   PI_THINKING         off | minimal | low | medium | high | xhigh
 *
 * CI-injected:
 *   ISSUE_NUMBER, ISSUE_TITLE, ISSUE_BODY, GITHUB_TOKEN
 */

import { EventEmitter } from "events";
import { getModel } from "@earendil-works/pi-ai";

EventEmitter.defaultMaxListeners = 20;
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const PROVIDER = process.env.PI_PROVIDER;
const API_KEY = process.env.PI_API_KEY;
const MODEL_ID = process.env.PI_MODEL;
const THINKING = process.env.PI_THINKING;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;

// ---- Suppress internal pi SDK AbortSignal listener warning ----
process.on("warning", (w) => {
  if (w.name === "MaxListenersExceededWarning" && w.message.includes("AbortSignal")) return;
  console.warn(w);
});

// ---- Validate required vars ----
const missing = [];
if (!PROVIDER) missing.push("PI_PROVIDER");
if (!API_KEY) missing.push("PI_API_KEY");
if (!ISSUE_NUMBER) missing.push("ISSUE_NUMBER");
if (missing.length) {
  console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ---- Auth ----
const authStorage = AuthStorage.create();
authStorage.setRuntimeApiKey(PROVIDER, API_KEY);

// ---- Resolve model (optional — pi picks its default if unset) ----
let model;
if (MODEL_ID) {
  model = getModel(PROVIDER, MODEL_ID);
  if (!model) {
    console.error(`❌ Model not found: ${PROVIDER}/${MODEL_ID}`);
    process.exit(1);
  }
}

// ---- Thinking level (optional) ----
const validThinking = ["off", "minimal", "low", "medium", "high", "xhigh"];
if (THINKING && !validThinking.includes(THINKING)) {
  console.error(`❌ Invalid PI_THINKING: ${THINKING}. Must be one of: ${validThinking.join(", ")}`);
  process.exit(1);
}

// ---- Session ----
const { session } = await createAgentSession({
  authStorage,
  modelRegistry: ModelRegistry.create(authStorage),
  sessionManager: SessionManager.inMemory(),
  tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
  cwd: process.cwd(),
  ...(model && { model }),
  ...(THINKING && { thinkingLevel: THINKING }),
});

// ---- Cost/context tracking ----
function logUsage(session) {
  const messages = session.messages;
  let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
  for (const m of messages) {
    if (m.role === "assistant" && m.usage) {
      input += m.usage.input || 0;
      output += m.usage.output || 0;
      cacheRead += m.usage.cacheRead || 0;
      cacheWrite += m.usage.cacheWrite || 0;
      cost += m.usage.cost?.total || 0;
    }
  }
  const tokens = input + output;
  const ctx = session.model?.contextWindow || 0;
  const pct = ctx ? `(${((tokens / ctx) * 100).toFixed(1)}%)` : "";
  console.log(`💰 tokens: ${tokens.toLocaleString()}${ctx ? " / " + ctx.toLocaleString() + " " + pct : ""}  |  in: ${input.toLocaleString()}  out: ${output.toLocaleString()}  |  cache r/w: ${cacheRead.toLocaleString()} / ${cacheWrite.toLocaleString()}  |  $${cost.toFixed(4)}`);
}

// ---- Debug: log all events to CI output ----
let turnCount = 0;
let toolCount = 0;

session.subscribe((event) => {
  switch (event.type) {
    case "message_start":
      console.log(`\n📨 message_start (role: ${event.message?.role})`);
      break;

    case "message_update": {
      const e = event.assistantMessageEvent;
      switch (e.type) {
        case "text_delta":
          process.stdout.write(e.delta);
          break;
        case "thinking_delta":
          process.stdout.write(e.delta);
          break;
        case "toolcall_start":
          toolCount++;
          break;
        case "toolcall_end":
          console.log(`\n🔧 tool call: ${e.toolCall?.name}(${JSON.stringify(e.toolCall?.arguments).slice(0, 120)})`);
          break;
        case "error":
          console.error(`\n❌ message error: ${e.reason}`);
          break;
      }
      break;
    }

    case "message_end":
      console.log(`\n📨 message_end (role: ${event.message?.role})`);
      break;

    case "tool_execution_start":
      console.log(`  ▶️ running ${event.toolName}...`);
      break;

    case "tool_execution_end": {
      const result = event.result;
      const preview = result?.content?.[0]?.text?.slice(0, 200) || "";
      const icon = event.isError ? "❌" : "✅";
      console.log(`  ${icon} ${event.toolName}: ${preview}${preview.length === 200 ? "…" : ""}`);
      break;
    }

    case "turn_start":
      turnCount++;
      console.log(`\n--- turn ${turnCount} start ---`);
      break;

    case "turn_end": {
      const msgs = event.message?.content || [];
      const texts = msgs.filter((c) => c.type === "text").length;
      const tools = msgs.filter((c) => c.type === "toolCall").length;
      console.log(`--- turn ${turnCount} end (${texts} texts, ${tools} tool calls, stop: ${event.message?.stopReason}) ---`);
      logUsage(session);
      console.log();
      break;
    }

    case "agent_end":
      console.log(`\n🏁 agent_end — messages generated: ${event.messages?.length || 0}`);
      break;

    case "compaction_start":
      console.log(`🗜️ compaction started (reason: ${event.reason})`);
      break;

    case "compaction_end":
      console.log(`🗜️ compaction ended (aborted: ${event.aborted}, willRetry: ${event.willRetry})`);
      break;

    case "auto_retry_start":
      console.log(`🔄 retry ${event.attempt}/${event.maxAttempts} in ${event.delayMs}ms: ${event.errorMessage?.slice(0, 120)}`);
      break;

    case "auto_retry_end":
      console.log(`🔄 retry end: success=${event.success}, attempt=${event.attempt}${event.finalError ? ", error: " + event.finalError.slice(0, 120) : ""}`);
      break;
  }
});

let agentFailed = false;
let agentFailedReason = "";

// ---- Catch unhandled rejections (e.g. internal pi errors) ----
process.on("unhandledRejection", (reason) => {
  console.error(`🔥 unhandledRejection: ${reason?.message || reason}`);
  if (reason?.stack) console.error(reason.stack);
  agentFailed = true;
  agentFailedReason = reason?.message || String(reason);
});

// ---- Watch for agent ending (covers cases where prompt() hangs) ----
session.subscribe((event) => {
  if (event.type === "agent_end") {
    // Agent ended without error from our perspective — but check messages
    const last = session.messages[session.messages.length - 1];
    if (last?.role === "assistant" && last.stopReason === "error") {
      agentFailed = true;
      agentFailedReason = `stopReason=error on last assistant message`;
    }
  }
});

// ---- Run the prompt template ----
const config = [PROVIDER, model?.id || "default", THINKING || "default"]
  .filter(Boolean)
  .join(", ");
console.log(`🚀 /implement-ticket ${ISSUE_NUMBER}  (${config})\n`);

// Race the prompt against a timeout (prevents hanging if API errors are swallowed)
const PROMPT_TIMEOUT_MS = 25 * 60 * 1000; // 25 min (workflow timeout is 30)
let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  console.error(`\n⏰ Prompt timed out after ${PROMPT_TIMEOUT_MS / 60000}min`);
  session.abort().catch(() => {});
}, PROMPT_TIMEOUT_MS);

try {
  await session.prompt(`/implement-ticket ${ISSUE_NUMBER}`);
  clearTimeout(timeout);
  console.log("\n✅ prompt() resolved");
} catch (err) {
  clearTimeout(timeout);
  console.error(`\n💥 Agent threw: ${err.message}`);
  if (err.cause) console.error(`   cause: ${err.cause}`);
  if (err.stack) console.error(err.stack);
  process.exitCode = 1;
}

// ---- Final state dump ----
console.log(`\n📊 Final state:`);
console.log(`   isStreaming: ${session.isStreaming}`);
console.log(`   messages: ${session.messages.length}`);
logUsage(session);
const lastMsg = session.messages[session.messages.length - 1];
if (lastMsg) {
  console.log(`   last message role: ${lastMsg.role}`);
  if (lastMsg.role === "assistant") {
    console.log(`   stopReason: ${lastMsg.stopReason}`);
    const lastContent = lastMsg.content?.[lastMsg.content.length - 1];
    if (lastContent?.type === "text") {
      console.log(`   last text: ${lastContent.text?.slice(0, 300)}`);
    }
  }
}
const errMsg = session.messages.find((m) => m.role === "assistant" && m.stopReason === "error");
if (errMsg) {
  console.error(`⚠️  Found assistant message with stopReason=error`);
}

session.dispose();

if (timedOut) {
  console.error("⏰ Exiting due to timeout");
  process.exit(1);
}
if (agentFailed) {
  console.error(`❌ Exiting due to agent failure: ${agentFailedReason}`);
  process.exit(1);
}
