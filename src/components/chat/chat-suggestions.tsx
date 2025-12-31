import { AlignLeft, ChartNoAxesColumn, Library, Search } from "lucide-react";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";

export interface ChatSuggestion {
	id: "summarize" | "analyze" | "search" | "agenda";
	title: string;
	prompt: string;
	badge?: string;
	label?: string;
	icon: React.ReactNode;
}

export function getDefaultChatSuggestions(opts: {
	hasPageContext: boolean;
}): ChatSuggestion[] {
	if (opts.hasPageContext) {
		return [
			{
				id: "summarize",
				title: "Summarize this page",
				prompt:
					"Summarize the referenced page. Include key takeaways and action items.",
				icon: <AlignLeft className="size-4" />,
			},
			{
				id: "analyze",
				title: "Analyze for insights",
				badge: "New",
				prompt:
					"Analyze the referenced page for insights: themes, risks, open questions, and recommendations.",
				icon: <ChartNoAxesColumn className="size-4" />,
			},
		];
	}

	return [
		{
			id: "search",
			title: "Search for anything",
			prompt:
				"Search my workspace for the topic I provide. Return the top matches as a short list with page titles and 1–2 sentence summaries. Ask a follow-up question if the query is ambiguous.",
			icon: <Search className="size-4" />,
		},
		{
			id: "agenda",
			title: "Write meeting agenda",
			prompt:
				"Write a meeting agenda for the topic I provide. Include: goal, attendees/roles, a time-boxed agenda (30–60 min), prep materials, key questions/decisions, and follow-ups.",
			icon: <Library className="size-4" />,
		},
	];
}

export function ChatSuggestions({
	title = "How can I help you today?",
	suggestions,
	onSelect,
}: {
	title?: string;
	suggestions: ChatSuggestion[];
	onSelect: (prompt: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="font-semibold px-2">{title}</div>
			<div className="flex flex-col">
				{suggestions.map((suggestion) => (
					<button
						key={suggestion.id}
						type="button"
						className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
						onClick={() => onSelect(suggestion.prompt)}
					>
						<div className="flex items-start gap-3">
							<span className="mt-0.5 shrink-0 text-muted-foreground">
								{suggestion.icon}
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 min-w-0">
									<div className="truncate text-sm font-medium">
										{suggestion.title}
									</div>
									{suggestion.badge ? (
										<Badge
											variant="secondary"
											className="h-5 px-2 text-[10px] bg-primary/15 text-primary"
										>
											{suggestion.badge}
										</Badge>
									) : null}
								</div>
								{suggestion.label ? (
									<div className="truncate text-xs text-muted-foreground">
										{suggestion.label}
									</div>
								) : null}
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
