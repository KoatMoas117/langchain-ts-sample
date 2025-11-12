import { MultiServerMCPClient } from "@langchain/mcp-adapters";

export const mcpClient = new MultiServerMCPClient({
  "file-system": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./"],
    transport: "stdio",
  },
  "aws-knowledge-mcp-server": {
    url: "https://knowledge-mcp.global.api.aws",
    transport: "http",
  },
});
