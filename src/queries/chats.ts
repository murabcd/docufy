import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const chatsQueries = {
	list: (args: { documentId: Id<"documents"> | null }) =>
		convexQuery(api.chats.list, { documentId: args.documentId }),
	messages: (chatId: Id<"chats">) =>
		convexQuery(api.chats.messages, { chatId }),
};
