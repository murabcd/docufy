import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const documentsQueries = {
	get: (id: Id<"documents">) => convexQuery(api.documents.get, { id }),
	getAncestors: (id: Id<"documents">) =>
		convexQuery(api.documents.getAncestors, { id }),
	getPublished: (id: Id<"documents">) =>
		convexQuery(api.documents.getPublished, { id }),
	getAll: (workspaceId?: Id<"workspaces">) =>
		convexQuery(api.documents.getAll, { workspaceId }),
	listSidebar: (args: { workspaceId?: Id<"workspaces">; limit?: number }) =>
		convexQuery(api.documents.listSidebar, {
			workspaceId: args.workspaceId,
			limit: args.limit,
		}),
	listSharedSidebar: (args: {
		workspaceId?: Id<"workspaces">;
		limit?: number;
	}) =>
		convexQuery(api.documents.listSharedSidebar, {
			workspaceId: args.workspaceId,
			limit: args.limit,
		}),

	list: (args: {
		workspaceId?: Id<"workspaces">;
		parentId?: Id<"documents"> | null;
	}) =>
		convexQuery(api.documents.list, {
			workspaceId: args.workspaceId,
			parentId: args.parentId ?? null,
		}),

	listShared: (args: {
		workspaceId?: Id<"workspaces">;
		parentId?: Id<"documents"> | null;
	}) =>
		convexQuery(api.documents.listShared, {
			workspaceId: args.workspaceId,
			parentId: args.parentId ?? null,
		}),

	getTrash: (workspaceId?: Id<"workspaces">) =>
		convexQuery(api.documents.getTrash, { workspaceId }),

	recentlyUpdated: (args: { workspaceId?: Id<"workspaces">; limit?: number }) =>
		convexQuery(api.documents.getRecentlyUpdated, {
			workspaceId: args.workspaceId,
			limit: args.limit,
		}),

	listIndex: (args: {
		workspaceId?: Id<"workspaces">;
		includeArchived?: boolean;
		limit?: number;
	}) =>
		convexQuery(api.documents.listIndex, {
			workspaceId: args.workspaceId,
			includeArchived: args.includeArchived,
			limit: args.limit,
		}),

	search: (args: {
		workspaceId?: Id<"workspaces">;
		term: string;
		limit?: number;
	}) =>
		convexQuery(api.documents.search, {
			workspaceId: args.workspaceId,
			term: args.term,
			limit: args.limit,
		}),

	searchInWorkspaces: (args: {
		term: string;
		workspaceIds?: Id<"workspaces">[];
		limit?: number;
	}) =>
		convexQuery(api.documents.searchInWorkspaces, {
			term: args.term,
			workspaceIds: args.workspaceIds,
			limit: args.limit,
		}),
};
