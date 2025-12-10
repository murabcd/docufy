import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
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

	notFoundComponent: () => <NotFound />,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script src="https://unpkg.com/react-scan/dist/auto.global.js" />
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
