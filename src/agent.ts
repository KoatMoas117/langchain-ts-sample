import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, createAgent, initChatModel } from "langchain";
import Parser from "rss-parser";
import { z } from "zod";

const MAX_UPDATES_COUNT = 3;
const MODEL_NAME = "llama3.1:8b";

type RssAwsItem = {
  title?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

type AwsUpdate = {
  published: string | undefined;
  summary: string | undefined;
};

export const getAwsUpdatesInputSchema = z.object({
  serviceName: z.string().describe("アップデートを検索するAWSサービス名"),
});

export type getAwsUpdatesInput = z.infer<typeof getAwsUpdatesInputSchema>;

const getFeeds = async (): Promise<Parser.Output<RssAwsItem>> => {
  try {
    const parser = new Parser<RssAwsItem>();
    return await parser.parseURL(
      "https://aws.amazon.com/about-aws/whats-new/recent/feed/"
    );
  } catch (error) {
    console.error("RSSフィードの取得に失敗しました:", error);
    throw Error("aaa");
  }
};

function filterAndFormatUpdates(
  feedItems: Array<RssAwsItem>,
  serviceName: string
): Array<AwsUpdate> {
  const results: Array<AwsUpdate> = [];
  const lowerCaseServiceName = serviceName.toLowerCase();

  for (const entry of feedItems) {
    if (!entry.title) {
      continue;
    }

    const lowerCaseTitle = entry.title.toLowerCase();
    if (lowerCaseTitle.includes(lowerCaseServiceName)) {
      results.push({
        published: entry.pubDate,
        summary: entry.contentSnippet || entry.content,
      });
    }

    if (results.length >= MAX_UPDATES_COUNT) {
      break;
    }
  }
  return results;
}

const getAwsUpdatesTool = new DynamicStructuredTool({
  name: "getAwsUpdates",
  description: `指定されたAWSサービスの最新アップデートをRSSフィードから${MAX_UPDATES_COUNT}件まで取得します。`, // 定数を使用
  schema: getAwsUpdatesInputSchema,
  func: async ({
    serviceName,
  }: {
    serviceName: getAwsUpdatesInput["serviceName"];
  }): Promise<string> => {
    const feeds = await getFeeds();

    const updates = filterAndFormatUpdates(feeds.items, serviceName);

    return JSON.stringify(updates, null, 2);
  },
});

export const llm = await initChatModel(MODEL_NAME, {
  modelProvider: "ollama",
});
const llmWithTools = llm.bindTools([getAwsUpdatesTool]);

type MessageState = {
  messages: Array<BaseMessage>;
};

export const agent = createAgent({
  model: llm,
  tools: [getAwsUpdatesTool],
});

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
