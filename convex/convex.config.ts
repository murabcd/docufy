import { defineApp } from "convex/server";
import crons from "@convex-dev/crons/convex.config.js";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";
import betterAuth from "@convex-dev/better-auth/convex.config.js";

const app = defineApp();
app.use(prosemirrorSync);
app.use(crons);
app.use(betterAuth);

export default app;
