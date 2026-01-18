"use node";

import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ImportTextOrMarkdownArgs = {
	workspaceId: Id<"workspaces">;
	teamspaceId?: Id<"teamspaces">;
	storageId: Id<"_storage">;
	filename: string;
	parentId?: Id<"documents">;
};

export const importTextOrMarkdown = action({
	args: {
		workspaceId: v.id("workspaces"),
		teamspaceId: v.optional(v.id("teamspaces")),
		storageId: v.id("_storage"),
		filename: v.string(),
		parentId: v.optional(v.id("documents")),
	},
	returns: v.id("documents"),
	handler: async (
		ctx: ActionCtx,
		args: ImportTextOrMarkdownArgs,
	): Promise<Id<"documents">> => {
		const url: string | null = await ctx.runQuery(
			internal.imports.getImportStorageUrl,
			{
				storageId: args.storageId,
			},
		);
		if (!url) throw new ConvexError("File not found");

		const response: Response = await fetch(url);
		if (!response.ok) throw new ConvexError("File not found");

		const rawText: string = await response.text();

		return await ctx.runMutation(internal.imports.importTextOrMarkdownInternal, {
			workspaceId: args.workspaceId,
			teamspaceId: args.teamspaceId,
			rawText,
			filename: args.filename,
			parentId: args.parentId,
		});
	},
});
