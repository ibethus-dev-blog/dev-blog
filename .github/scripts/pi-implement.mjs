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

import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  getModel,
} from "@earendil-works/pi-coding-agent";

const PROVIDER = process.env.PI_PROVIDER;
const API_KEY = process.env.PI_API_KEY;
const MODEL_ID = process.env.PI_MODEL;
const THINKING = process.env.PI_THINKING;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;

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

// ---- Stream output to CI logs ----
session.subscribe((event) => {
  if (
    event.type === "message_update" &&
    event.assistantMessageEvent.type === "text_delta"
  ) {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// ---- Run the prompt template ----
const config = [PROVIDER, model?.id || "default", THINKING || "default"]
  .filter(Boolean)
  .join(", ");
console.log(`🚀 /implement-ticket ${ISSUE_NUMBER}  (${config})\n`);
await session.prompt(`/implement-ticket ${ISSUE_NUMBER}`);
console.log("\n✅ Done");

session.dispose();
