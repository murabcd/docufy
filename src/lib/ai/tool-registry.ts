import type { ServerTool } from "@tanstack/ai";
import type { ConvexHttpClient } from "convex/browser";
import { createGetPageTool } from "@/lib/ai/tools/get-page";
import { createRenamePageTool } from "@/lib/ai/tools/rename-page";
import { createSaveMemoryFactTool } from "@/lib/ai/tools/save-memory-fact";
import { createSearchPagesTool } from "@/lib/ai/tools/search-pages";
import { createUpdatePageTool } from "@/lib/ai/tools/update-page";
import { createWebSearchTool } from "@/lib/ai/tools/web-search";
import type { Id } from "../../../convex/_generated/dataModel";

export const createChatTools = (args: {
	workspaceId?: Id<"workspaces">;
	documentId?: Id<"documents">;
	memoryEnabled?: boolean;
	webSearchEnabled?: boolean;
	convex: ConvexHttpClient;
}) => {
	const tools: Array<ServerTool> = [];

	tools.push(
		createSearchPagesTool({
			workspaceId: args.workspaceId,
			convex: args.convex,
		}),
	);

	if (args.webSearchEnabled) {
		tools.push(createWebSearchTool());
	}
	tools.push(createGetPageTool({ convex: args.convex }));
	tools.push(createRenamePageTool({ convex: args.convex }));
	tools.push(
		createUpdatePageTool({
			defaultWorkspaceId: args.workspaceId,
			convex: args.convex,
		}),
	);

	if (args.memoryEnabled) {
		tools.push(
			createSaveMemoryFactTool({
				workspaceId: args.workspaceId,
				convex: args.convex,
			}),
		);
	}

	return tools;
};
