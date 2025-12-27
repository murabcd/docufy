import type { Editor } from "@tiptap/react";
import { CornerDownLeft, ExternalLink, Link, Trash } from "lucide-react";
import React, { useCallback, useEffect, useEffectEvent, useState } from "react";
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
import { addOrUpdateLink, unsetLink } from "@/tiptap/helpers";
import EditorButton from "./editor-button";

interface LinkButtonMenuProps {
	editor: Editor;
}

const LinkButtonMenu = ({ editor }: LinkButtonMenuProps) => {
	const [menuOpened, setMenuOpened] = useState(false);
	const [linkValue, setLinkValue] = useState("");
	const [isActive, setIsActive] = useState(false);

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
		if (linkValue) {
			window.open(linkValue, "_blank", "noopener,noreferrer,nofollow");
		}
	}, [linkValue]);

	const removeLink = useCallback(() => {
		unsetLink(editor);
		setLinkValue("");
		setIsActive(false);
		setMenuOpened(false);
	}, [editor]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter" && linkValue) {
				e.preventDefault();
				addLink();
			}
		},
		[addLink, linkValue],
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

			<PopoverContent className="w-fit p-1.5">
				<div className="flex items-center gap-1">
					<div className="relative flex flex-wrap items-stretch">
						<input
							className="block w-full h-8 text-sm font-normal leading-1.5 px-2 py-1.5 bg-none appearance-none outline-none"
							placeholder="Enter a link..."
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							type="url"
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
							icon={Trash}
							withActive={false}
							onPressed={removeLink}
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default React.memo(LinkButtonMenu);
