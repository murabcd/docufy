import { Crons } from "@convex-dev/crons";
import { internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";

const crons = new Crons(components.crons);

export const ensureTrashCleanupCron = internalMutation({
	handler: async (ctx) => {
		const name = "trash-cleanup-daily";
		if ((await crons.get(ctx, { name })) !== null) {
			return null;
		}

		await crons.register(
			ctx,
			{ kind: "cron", cronspec: "0 0 * * *" },
			internal.documents.cleanupTrash,
			{},
			name,
		);

		return null;
	},
});
