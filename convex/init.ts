import { Crons } from "@convex-dev/crons";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";

const crons = new Crons(components.crons);

export const ensureTrashCleanupCron = internalMutation({
	args: {},
	returns: v.null(),
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

export const ensureGuestCleanupCron = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const name = "guest-cleanup-daily";
		if ((await crons.get(ctx, { name })) !== null) {
			return null;
		}

		await crons.register(
			ctx,
			{ kind: "cron", cronspec: "0 0 * * *" },
			internal.guestCleanup.cleanupAnonymousUsers,
			{},
			name,
		);

		return null;
	},
});
