import "./polyfills/session-storage";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexProvider } from "convex/react";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const CONVEX_URL = (import.meta as { env?: { VITE_CONVEX_URL?: string } }).env
		?.VITE_CONVEX_URL;
	if (!CONVEX_URL) {
		console.error("missing envar VITE_CONVEX_URL");
		throw new Error("VITE_CONVEX_URL is required");
	}

	const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
			},
		},
	});
	convexQueryClient.connect(queryClient);

	const router = routerWithQueryClient(
		createRouter({
			routeTree,
			scrollRestoration: true,
			defaultPreloadStaleTime: 0,
			context: { queryClient },
			Wrap: ({ children }) => (
				<ConvexProvider client={convexQueryClient.convexClient}>
					{children}
				</ConvexProvider>
			),
		}),
		queryClient,
	);

	return router;
};
