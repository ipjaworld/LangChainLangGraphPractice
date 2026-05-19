import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import type { ClientChatMessage } from "./types";

export function parseClientMessages(body: {
  message?: string;
  messages?: ClientChatMessage[];
}): BaseMessage[] {
  if (body.messages?.length) {
    return body.messages
      .filter((item) => item.content.trim())
      .map((item) =>
        item.role === "user"
          ? new HumanMessage(item.content.trim())
          : new AIMessage(item.content.trim())
      );
  }

  if (body.message?.trim()) {
    return [new HumanMessage(body.message.trim())];
  }

  return [];
}

export function getLatestHumanText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]._getType() === "human") {
      return messages[i].content as string;
    }
  }
  return "";
}
