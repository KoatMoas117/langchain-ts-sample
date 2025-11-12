import { createAgent, initChatModel } from "langchain";
import { getAwsUpdatesTool } from "./tools/getAwsUpdates";

const MODEL_NAME = "llama3.1:8b";

const llm = await initChatModel(MODEL_NAME, {
  modelProvider: "ollama",
});
export const llmWithTools = llm.bindTools([getAwsUpdatesTool]);

export const agent = createAgent({
  model: llm,
  tools: [getAwsUpdatesTool],
});
