import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const documentsQueries = {
	get: (id: Id<"documents">) => convexQuery(api.documents.get, { id }),
	getAncestors: (id: Id<"documents">) =>
		convexQuery(api.documents.getAncestors, { id }),
	getPublished: (id: Id<"documents">) =>
		convexQuery(api.documents.getPublished, { id }),
	getMyAccessLevel: (id: Id<"documents">) =>
		convexQuery(api.documents.getMyAccessLevel, { id }),
	getAll: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
	}) =>
		convexQuery(api.documents.getAll, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
		}),
	listSidebar: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		limit?: number;
	}) =>
		convexQuery(api.documents.listSidebar, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			limit: args.limit,
		}),
	listPersonalSidebar: (args?: { limit?: number }) =>
		convexQuery(api.documents.listPersonalSidebar, {
			limit: args?.limit,
		}),
	listSharedSidebar: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		limit?: number;
	}) =>
		convexQuery(api.documents.listSharedSidebar, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			limit: args.limit,
		}),
	list: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		parentId?: Id<"documents"> | null;
	}) =>
		convexQuery(api.documents.list, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			parentId: args.parentId ?? null,
		}),
	getTrash: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
	}) =>
		convexQuery(api.documents.getTrash, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
		}),
	recentlyUpdated: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		limit?: number;
	}) =>
		convexQuery(api.documents.getRecentlyUpdated, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			limit: args.limit,
		}),
	listIndex: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		includeArchived?: boolean;
		limit?: number;
	}) =>
		convexQuery(api.documents.listIndex, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			includeArchived: args.includeArchived,
			limit: args.limit,
		}),
	search: (args: {
		workspaceId?: Id<"workspaces">;
		teamspaceId?: Id<"teamspaces">;
		term: string;
		limit?: number;
	}) =>
		convexQuery(api.documents.search, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			term: args.term,
			limit: args.limit,
		}),
};
