import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain";
import Parser from "rss-parser";
import { z } from "zod";

const MAX_UPDATES_COUNT = 3;

export const getAwsUpdatesInputSchema = z.object({
  serviceName: z.string().describe("アップデートを検索するAWSサービス名"),
});

export type getAwsUpdatesInput = z.infer<typeof getAwsUpdatesInputSchema>;

type AwsUpdate = {
  published: string | undefined;
  summary: string | undefined;
};

type RssAwsItem = {
  title?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
};

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

const llm = new ChatOllama({
  model: "llama3.1:8b",
});

export const agent = createAgent({
  model: llm,
  tools: [getAwsUpdatesTool],
});
