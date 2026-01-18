import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const teamspacesQueries = {
	listForWorkspace: (workspaceId: Id<"workspaces">) =>
		convexQuery(api.teamspaces.listForWorkspace, {
			workspaceId,
		}),
	members: (teamspaceId: Id<"teamspaces">) =>
		convexQuery(api.teamspaces.listMembers, {
			teamspaceId,
		}),
};
