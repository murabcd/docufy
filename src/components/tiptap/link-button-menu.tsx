import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { CornerDownLeft, ExternalLink, Link, Trash2 } from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { documentsQueries } from "@/queries";
import { addOrUpdateLink, normalizeHref, unsetLink } from "@/tiptap/helpers";
import type { Doc } from "../../../convex/_generated/dataModel";
import EditorButton from "./editor-button";

interface LinkButtonMenuProps {
	editor: Editor;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(id);
	}, [delayMs, value]);
	return debounced;
}

function looksLikeUrl(value: string) {
	const v = value.trim();
	if (!v) return false;
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return true;
	if (/^(mailto:|tel:)/i.test(v)) return true;
	if (v.startsWith("/")) return true;
	if (/^[^\s]+\.[^\s]+$/.test(v)) return true;
	return false;
}

const LinkButtonMenu = ({ editor }: LinkButtonMenuProps) => {
	const [menuOpened, setMenuOpened] = useState(false);
	const [linkValue, setLinkValue] = useState("");
	const [isActive, setIsActive] = useState(false);
	const { activeWorkspaceId, activeTeamspaceId } = useActiveWorkspace();

	const debouncedSearchTerm = useDebouncedValue(linkValue.trim(), 150);
	const shouldShowInternalResults = useMemo(() => {
		if (!menuOpened) return false;
		if (!activeWorkspaceId) return false;
		if (!debouncedSearchTerm) return true;
		return !looksLikeUrl(debouncedSearchTerm);
	}, [activeWorkspaceId, debouncedSearchTerm, menuOpened]);

	const { data: recentDocuments = [], isFetching: isFetchingRecentDocuments } =
		useQuery({
			...documentsQueries.recentlyUpdated({
				workspaceId: activeWorkspaceId ?? undefined,
				teamspaceId: activeTeamspaceId ?? undefined,
				limit: 6,
			}),
			enabled: menuOpened && !!activeWorkspaceId,
			placeholderData: keepPreviousData,
			gcTime: 10_000,
		});

	const { data: allDocuments = [] } = useQuery({
		...documentsQueries.listIndex({
			workspaceId: activeWorkspaceId ?? undefined,
			teamspaceId: activeTeamspaceId ?? undefined,
			includeArchived: false,
			limit: 2_000,
		}),
		enabled: menuOpened && !!activeWorkspaceId,
		placeholderData: keepPreviousData,
		gcTime: 10_000,
	});

	const getCurrentLink = useCallback(() => {
		return editor.getAttributes("link")?.href || "";
	}, [editor]);

	// Use useEffectEvent to avoid re-running effect when getCurrentLink reference changes
	const onUpdateState = useEffectEvent(() => {
		const href = getCurrentLink();
		setLinkValue(href);
		setIsActive(editor.isActive("link", { href }));
	});

	useEffect(() => {
		editor.on("selectionUpdate", onUpdateState);
		editor.on("transaction", onUpdateState);

		return () => {
			editor.off("selectionUpdate", onUpdateState);
			editor.off("transaction", onUpdateState);
		};
	}, [editor]); // onUpdateState is an Effect Event, doesn't need to be in dependencies

	const addLink = useCallback(() => {
		if (!linkValue) return;
		addOrUpdateLink(editor, linkValue);
		// ensure active state updates post-link
		setIsActive(true);
	}, [editor, linkValue]);

	const openInNewTab = useCallback(() => {
		const href = normalizeHref(linkValue);
		if (!href) return;
		window.open(href, "_blank", "noopener,noreferrer,nofollow");
	}, [linkValue]);

	const removeLink = useCallback(() => {
		unsetLink(editor);
		setLinkValue("");
		setIsActive(false);
		setMenuOpened(false);
	}, [editor]);

	const selectDocument = useCallback(
		(document: Pick<Doc<"documents">, "_id">) => {
			const href = `/documents/${document._id}`;
			addOrUpdateLink(editor, href);
			setLinkValue(href);
			setIsActive(true);
			setMenuOpened(false);
		},
		[editor],
	);

	const internalResults = useMemo(() => {
		const term = debouncedSearchTerm.trim();
		if (!term) {
			return { kind: "recents" as const, items: recentDocuments };
		}

		const termLower = term.toLowerCase();
		const matches = allDocuments
			.filter((doc) => (doc.title ?? "").toLowerCase().includes(termLower))
			.slice(0, 10);

		return { kind: "search" as const, items: matches };
	}, [allDocuments, debouncedSearchTerm, recentDocuments]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key !== "Enter") return;

			const term = linkValue.trim();
			if (!term) return;

			if (!looksLikeUrl(term) && internalResults.items.length > 0) {
				e.preventDefault();
				selectDocument(internalResults.items[0]);
				return;
			}

			e.preventDefault();
			addLink();
		},
		[addLink, internalResults.items, linkValue, selectDocument],
	);

	return (
		<Popover open={menuOpened} onOpenChange={setMenuOpened}>
			<PopoverTrigger asChild>
				<Button
					data-active={isActive}
					type="button"
					size="icon-sm"
					variant="ghost"
					aria-label="Link menu"
					className="text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-primary data-[active=true]:hover:bg-accent"
					onClick={() => setMenuOpened((open) => !open)}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="w-full h-full flex items-center justify-center">
								<Link className="w-4 h-4" strokeWidth={2.5} />
							</div>
						</TooltipTrigger>
						<TooltipContent>Link</TooltipContent>
					</Tooltip>
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-80 p-1.5">
				<div className="flex items-center gap-1">
					<div className="relative flex-1 flex flex-wrap items-stretch">
						<input
							className="block w-full h-8 text-sm font-normal leading-1.5 px-2 py-1.5 bg-none appearance-none outline-none"
							placeholder="Paste link or search pages"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							type="text"
							value={linkValue}
							onChange={(e) => setLinkValue(e.target.value)}
							onKeyDown={handleKeyDown}
						/>
					</div>

					<EditorButton
						isIconOnly
						isDisabled={!linkValue}
						editor={editor}
						buttonKey="validate"
						tooltipText="Set link"
						icon={CornerDownLeft}
						withActive={false}
						onPressed={addLink}
					/>

					<Separator orientation="vertical" className="h-6" />

					<div className="flex items-center gap-1.5">
						<EditorButton
							isIconOnly
							isDisabled={!linkValue}
							editor={editor}
							buttonKey="open_in_new_tab"
							tooltipText="Open link"
							icon={ExternalLink}
							withActive={false}
							onPressed={openInNewTab}
						/>

						<EditorButton
							isIconOnly
							isDisabled={!linkValue}
							buttonKey="remove_link"
							className="text-destructive hover:text-destructive"
							editor={editor}
							tooltipText="Remove link"
							icon={Trash2}
							withActive={false}
							onPressed={removeLink}
						/>
					</div>
				</div>

				{shouldShowInternalResults && (
					<div className="mt-1 rounded-md overflow-hidden">
						<div className="max-h-64 overflow-auto py-1">
							<div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
								{internalResults.kind === "recents" ? "Recents" : "Pages"}
							</div>

							{internalResults.items.length === 0 &&
								!(internalResults.kind === "recents"
									? isFetchingRecentDocuments
									: false) && (
									<div className="py-6 text-center text-sm">
										No pages found.
									</div>
								)}

							{internalResults.items.map((doc) => (
								<button
									key={doc._id}
									type="button"
									className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-md hover:bg-accent"
									onMouseDown={(e) => {
										e.preventDefault();
										selectDocument(doc);
									}}
								>
									<span className="truncate">{doc.title ?? "New page"}</span>
								</button>
							))}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
};

export default React.memo(LinkButtonMenu);
