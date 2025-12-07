import { chat, toStreamResponse } from "@tanstack/ai";
import { openai } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				if (!process.env.OPENAI_API_KEY) {
					return new Response(
						JSON.stringify({
							error: "OPENAI_API_KEY not configured",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const { messages, conversationId } = await request.json();

				try {
					const stream = chat({
						adapter: openai(),
						messages,
						model: "gpt-4o",
						conversationId,
					});

					return toStreamResponse(stream);
				} catch (error) {
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "An unexpected error occurred",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
