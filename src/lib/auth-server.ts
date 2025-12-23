import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
	throw new Error("VITE_CONVEX_URL is not set");
}

const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL;
if (!convexSiteUrl) {
	throw new Error("VITE_CONVEX_SITE_URL is not set");
}

export const {
	handler,
	getToken,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = convexBetterAuthReactStart({
	convexUrl,
	convexSiteUrl,
});
