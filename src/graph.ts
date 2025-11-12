import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, SystemMessage } from "langchain";
import { llmWithTools, tools } from "./models";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";

type MessageState = {
  messages: Array<BaseMessage>;
};

const callModel = async (state: MessageState): Promise<MessageState> => {
  const systemPrompt = new SystemMessage(`
  あなたの責務はAWSドキュメントを検索し、Markdown形式としてファイル出力することです。
  - 検索後、Markdown形式に変換してください。
  - 検索は最大で2回までとし、その時点での情報を出力してください。
`);
  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);
  return {
    messages: [...state.messages, response],
  };
};

const toolNode = new ToolNode(tools);

const NEXT_STEP = {
  TOOL: "tools",
} as const;

type NextStep = (typeof NEXT_STEP)[keyof typeof NEXT_STEP];

const shouldContinue = (state: MessageState): NextStep | typeof END => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!(lastMessage instanceof AIMessage)) {
    return END;
  }
  if (!lastMessage.tool_calls) {
    return END;
  }

  if (lastMessage.tool_calls.length === 0) {
    return END;
  }

  return NEXT_STEP.TOOL;
};

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("llm", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "llm")
  .addConditionalEdges("llm", shouldContinue)
  .addEdge("tools", "llm")
  .compile();
