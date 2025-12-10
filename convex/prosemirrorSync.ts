import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

type AnyCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

const getDocumentOrThrow = async (
	ctx: AnyCtx,
	id: Id<"documents">,
) => {
	const document = await ctx.db.get(id);
	if (!document) {
		throw new Error("Document not found");
	}
	return document;
};

const prosemirrorSync = new ProsemirrorSync<Id<"documents">>(
	components.prosemirrorSync,
);

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
	checkRead: async (ctx, id) => {
		await getDocumentOrThrow(ctx, id);
	},
	checkWrite: async (ctx, id) => {
		await getDocumentOrThrow(ctx, id);
	},
	onSnapshot: async (ctx, id, snapshot) => {
		await getDocumentOrThrow(ctx, id);
		await ctx.db.patch(id, {
			content: snapshot,
			updatedAt: Date.now(),
		});
	},
});

export { prosemirrorSync };
