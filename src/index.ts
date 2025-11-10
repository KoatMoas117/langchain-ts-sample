import { serve } from "@hono/node-server";
import { HumanMessage } from "@langchain/core/messages";
import { Hono } from "hono";
import { validator } from "hono/validator";
import z from "zod";
import { agent } from "./agent";

const app = new Hono();

const schema = z.object({
  content: z.string().min(1),
});

app.post(
  "/search-updates",
  validator("form", async (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.text("Invalid!", 401);
    }
    return parsed.data;
  }),
  async (c) => {
    const { content } = c.req.valid("form");
    const response = await agent.invoke({
      messages: [new HumanMessage(content)],
    });
    console.log(response);
    return c.json(
      {
        message: "Created!",
      },
      201
    );
  }
);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
