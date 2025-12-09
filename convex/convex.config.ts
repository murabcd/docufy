import { defineApp } from "convex/server";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";

const app = defineApp();
app.use(prosemirrorSync);

export default app;
