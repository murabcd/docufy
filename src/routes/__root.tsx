import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";

import appCss from "@/styles.css?url";
import { api } from "../../convex/_generated/api";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
	return await getToken();
});

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Docufy",
			},
			{
				name: "description",
				content:
					"AI Document Management Platform Built with TanStack Start, TanStack AI and Convex.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
		],
	}),

	beforeLoad: async (ctx) => {
		const token = await getAuth();
		// all queries, mutations and actions through TanStack Query will be
		// authenticated during SSR if we have a valid token
		if (token) {
			// During SSR only (the only time serverHttpClient exists),
			// set the auth token to make HTTP queries with.
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}
		return {
			isAuthenticated: !!token,
			token,
		};
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			convexQuery(api.auth.getCurrentUser, {}),
		);
	},
	component: RootComponent,

	notFoundComponent: () => <NotFound />,
	shellComponent: RootDocument,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });
	return (
		<ConvexBetterAuthProvider
			client={context.convexQueryClient.convexClient}
			authClient={authClient}
			initialToken={context.token}
		>
			<Outlet />
		</ConvexBetterAuthProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground">
				<HeroUIProvider>
					<ThemeProvider>
						<SidebarProvider>{children}</SidebarProvider>
						<TanStackDevtools
							config={{
								position: "bottom-right",
							}}
							plugins={[
								{
									name: "Tanstack Router",
									render: <TanStackRouterDevtoolsPanel />,
								},
							]}
						/>
						<ToastProvider placement="top-right" />
						<Toaster position="top-center" />
						<Scripts />
					</ThemeProvider>
				</HeroUIProvider>
			</body>
		</html>
	);
}
