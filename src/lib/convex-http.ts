import { getToken } from "@convex-dev/better-auth/utils";
import { ConvexHttpClient } from "convex/browser";

const getEnv = (keys: string | string[]) => {
	const candidates = Array.isArray(keys) ? keys : [keys];
	for (const key of candidates) {
		const value = process.env[key];
		if (value) return value;
	}
	throw new Error(`${candidates.join(" or ")} is not set`);
};

export const createAuthedConvexHttpClient = async (request: Request) => {
	const convexUrl = getEnv("VITE_CONVEX_URL");
	const convexSiteUrl = getEnv("VITE_CONVEX_SITE_URL");

	const { token } = await getToken(
		convexSiteUrl,
		new Headers(request.headers),
		{
			jwtCache: {
				enabled: true,
				isAuthError: (error: unknown) => {
					return (
						error instanceof Error &&
						/unauthorized|not logged in|forbidden/i.test(error.message)
					);
				},
			},
		},
	);

	const client = new ConvexHttpClient(convexUrl);
	if (token) {
		client.setAuth(token);
	}
	// @ts-expect-error - setFetchOptions is internal
	client.setFetchOptions({ cache: "no-store" });

	return { client, token };
};
