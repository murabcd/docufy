import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi();

export { prosemirrorSync };
