import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMutation } from "convex/react";
import * as React from "react";
import { NotFound } from "@/components/layout/not-found";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ActiveWorkspaceProvider } from "@/hooks/use-active-workspace";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { authQueries } from "@/queries";
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
		await context.queryClient.ensureQueryData(authQueries.currentUser());
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
			<EnsureGuestSession hasInitialToken={Boolean(context.token)} />
			<EnsureGuestWorkspace />
			{context.isAuthenticated ? (
				<ActiveWorkspaceProvider>
					<Outlet />
				</ActiveWorkspaceProvider>
			) : null}
		</ConvexBetterAuthProvider>
	);
}

function EnsureGuestSession({ hasInitialToken }: { hasInitialToken: boolean }) {
	const {
		data: session,
		error,
		isPending,
		isRefetching,
	} = authClient.useSession();
	const router = useRouter();

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		if (isPending || isRefetching) return;
		if (hasInitialToken) return;
		if (error) {
			console.warn(
				"[auth] useSession failed; skipping anonymous sign-in",
				error,
			);
			return;
		}
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
				router.invalidate();
			})
			.catch((error) => {
				console.error(error);
				sessionStorage.removeItem(key);
			});
	}, [error, hasInitialToken, isPending, isRefetching, router, session]);

	return null;
}

function EnsureGuestWorkspace() {
	const { data: currentUser } = useSuspenseQuery(authQueries.currentUser());
	const ensureDefault = useMutation(api.workspaces.ensureDefault);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const isAnonymousUser = Boolean(
			(currentUser as { isAnonymous?: boolean } | null)?.isAnonymous,
		);
		if (!isAnonymousUser) return;
		ensureDefault({ defaultName: "Guest" }).catch((error) => {
			console.error(error);
		});
	}, [currentUser, ensureDefault]);

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
					<Toaster position="top-center" />
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}
