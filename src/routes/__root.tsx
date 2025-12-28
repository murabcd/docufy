import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { type ConvexQueryClient, convexQuery } from "@convex-dev/react-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { useMutation } from "convex/react";
import * as React from "react";
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
					"Notion-like Platform Built with TanStack Start, TanStack AI and Convex.",
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
			<EnsureGuestSession />
			<MigrateAnonymousData />
			{context.isAuthenticated ? <Outlet /> : null}
		</ConvexBetterAuthProvider>
	);
}

function EnsureGuestSession() {
	const { data: session, isPending } = authClient.useSession();

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (isPending) return;
		if (session?.user) {
			sessionStorage.removeItem("docufy:anonSignInAttemptedAt");
			return;
		}

		const key = "docufy:anonSignInAttemptedAt";
		const lastAttemptAt = Number(sessionStorage.getItem(key) || "0");
		if (lastAttemptAt && Date.now() - lastAttemptAt < 5_000) return;
		sessionStorage.setItem(key, String(Date.now()));

		authClient.signIn
			.anonymous()
			.then(() => {
				location.reload();
			})
			.catch((error) => {
				console.error(error);
				sessionStorage.removeItem(key);
			});
	}, [isPending, session]);

	return null;
}

function MigrateAnonymousData() {
	const { data: currentUser } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const migrateAnonymousData = useMutation(api.auth.migrateAnonymousData);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (!currentUser) return;

		const key = "docufy:migrateFromUserId";
		const fromUserId = localStorage.getItem(key);
		if (!fromUserId) return;

		const toUserId = String((currentUser as { _id?: unknown })._id);
		if (!toUserId || fromUserId === toUserId) {
			localStorage.removeItem(key);
			return;
		}

		migrateAnonymousData({ fromUserId })
			.then(() => {
				localStorage.removeItem(key);
				location.reload();
			})
			.catch((error) => {
				console.error(error);
			});
	}, [currentUser, migrateAnonymousData]);

	return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background text-foreground">
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
					<Toaster position="top-center" />
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}
