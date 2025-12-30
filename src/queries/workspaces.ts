import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const workspacesQueries = {
	mine: () => convexQuery(api.workspaces.listMine, {}),
	members: (workspaceId: Id<"workspaces">) =>
		convexQuery(api.workspaces.listMembers, {
			workspaceId,
		}),
};
