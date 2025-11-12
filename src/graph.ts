import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage } from "langchain";
import { llmWithTools } from "./models";
import { getAwsUpdatesTool } from "./tools/getAwsUpdates";
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
  const response = await llmWithTools.invoke(state.messages);
  return {
    messages: [...state.messages, response],
  };
};

const toolNode = new ToolNode([getAwsUpdatesTool]);

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
