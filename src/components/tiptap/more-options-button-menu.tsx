import type { Editor } from "@tiptap/react";
import {
	EllipsisVertical,
	Subscript,
	Superscript,
	TextAlignCenter,
	TextAlignEnd,
	TextAlignJustify,
	TextAlignStart,
} from "lucide-react";
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
import EditorButton from "./editor-button";

interface MoreOptionsButtonMenuProps {
	editor: Editor;
}

const MoreOptionsButtonMenu = ({ editor }: MoreOptionsButtonMenuProps) => {
	const computeIsActive = useCallback(() => {
		return (
			editor.isActive("subscript") ||
			editor.isActive("superscript") ||
			editor.isActive({ textAlign: "left" }) ||
			editor.isActive({ textAlign: "center" }) ||
			editor.isActive({ textAlign: "right" }) ||
			editor.isActive({ textAlign: "justify" })
		);
	}, [editor]);

	const [isActive, setIsActive] = useState(computeIsActive);

	// Use useEffectEvent to avoid re-running effect when computeIsActive reference changes
	const onUpdate = useEffectEvent(() => {
		setIsActive(computeIsActive());
	});

	useEffect(() => {
		editor.on("selectionUpdate", onUpdate);
		editor.on("transaction", onUpdate);
		return () => {
			editor.off("selectionUpdate", onUpdate);
			editor.off("transaction", onUpdate);
		};
	}, [editor]); // onUpdate is an Effect Event, doesn't need to be in dependencies

	const scriptButtons = useMemo(
		() => [
			{
				key: "superscript",
				icon: Superscript,
				tooltipText: "Superscript",
				command: () => editor.chain().focus().toggleSuperscript().run(),
			},
			{
				key: "subscript",
				icon: Subscript,
				tooltipText: "Subscript",
				command: () => editor.chain().focus().toggleSubscript().run(),
			},
		],
		[editor],
	);

	const alignButtons = useMemo(
		() => [
			{
				key: "left",
				icon: TextAlignStart,
				tooltipText: "Align left",
				command: () => editor.chain().focus().setTextAlign("left").run(),
			},
			{
				key: "center",
				icon: TextAlignCenter,
				tooltipText: "Align center",
				command: () => editor.chain().focus().setTextAlign("center").run(),
			},
			{
				key: "right",
				icon: TextAlignEnd,
				tooltipText: "Align right",
				command: () => editor.chain().focus().setTextAlign("right").run(),
			},
			{
				key: "justify",
				icon: TextAlignJustify,
				tooltipText: "Align justify",
				command: () => editor.chain().focus().setTextAlign("justify").run(),
			},
		],
		[editor],
	);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					data-active={isActive}
					aria-label="More options"
					className="text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-primary data-[active=true]:hover:bg-accent"
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="w-full h-full flex items-center justify-center">
								<EllipsisVertical className="w-4 h-4" strokeWidth={2.5} />
							</div>
						</TooltipTrigger>
						<TooltipContent>More options</TooltipContent>
					</Tooltip>
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-fit p-1.5">
				<div className="flex h-8 items-center gap-1.5">
					{scriptButtons.map((btn) => (
						<EditorButton
							key={btn.key}
							editor={editor}
							isIconOnly
							withActive
							buttonKey={btn.key}
							tooltipText={btn.tooltipText}
							icon={btn.icon}
							onPressed={btn.command}
						/>
					))}

					<Separator orientation="vertical" className="h-6" />

					{alignButtons.map((btn) => (
						<EditorButton
							key={btn.key}
							editor={editor}
							isIconOnly
							withActive
							buttonKey={{ textAlign: btn.key }}
							tooltipText={btn.tooltipText}
							icon={btn.icon}
							onPressed={btn.command}
						/>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default React.memo(MoreOptionsButtonMenu);
