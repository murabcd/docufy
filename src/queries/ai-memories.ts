import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const aiMemoriesQueries = {
	settings: (args: { workspaceId: Id<"workspaces"> }) =>
		convexQuery(api.aiMemories.getSettings, { workspaceId: args.workspaceId }),
	list: (args: { workspaceId: Id<"workspaces"> }) =>
		convexQuery(api.aiMemories.list, { workspaceId: args.workspaceId }),
};
