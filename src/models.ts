import { initChatModel } from "langchain";
import { getAwsUpdatesTool } from "./tools/getAwsUpdates";
import { mcpClient } from "./tools/mcpClient";

const MODEL_NAME = "llama3.1:8b";

// TODO: new でメソッド化する
const mcpTools = await mcpClient.getTools();
// TODO: toolsは依存注入したい
export const tools = [...mcpTools, getAwsUpdatesTool];

const llm = await initChatModel(MODEL_NAME, {
  modelProvider: "ollama",
});
export const llmWithTools = llm.bindTools(tools);

// export const agent = createAgent({
//   model: llm,
//   tools: [getAwsUpdatesTool],
// });
