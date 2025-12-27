import type { Editor } from "@tiptap/react";
import { Type } from "lucide-react";
import React, { useCallback, useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { colorSections } from "@/tiptap/constants";
import ColorButton from "./color-button";

interface ColorButtonMenuProps {
	editor: Editor;
}

const ColorButtonMenu = ({ editor }: ColorButtonMenuProps) => {
	const getTextColor = useCallback(
		() => editor.getAttributes("textStyle")?.color || "",
		[editor],
	);
	const getBgColor = useCallback(
		() => editor.getAttributes("highlight")?.color || "",
		[editor],
	);

	const [textAndBorderColor, setTextAndBorderColor] = useState(getTextColor);
	const [backgroundColor, setBackgroundColor] = useState(getBgColor);

	// Use useEffectEvent to avoid re-running effect when callback references change
	const onUpdateColors = useEffectEvent(() => {
		setTextAndBorderColor(getTextColor());
		setBackgroundColor(getBgColor());
	});

	useEffect(() => {
		editor.on("selectionUpdate", onUpdateColors);
		editor.on("transaction", onUpdateColors);
		return () => {
			editor.off("selectionUpdate", onUpdateColors);
			editor.off("transaction", onUpdateColors);
		};
	}, [editor]); // onUpdateColors is an Effect Event, doesn't need to be in dependencies

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					aria-label="Color menu"
					className="text-muted-foreground hover:text-foreground"
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="w-full h-full flex items-center justify-center">
								<span
									className="relative w-5 h-5 flex items-center justify-center border border-border rounded-full transition-transform duration-200 ease-in-out"
									style={{
										borderColor:
											textAndBorderColor ||
											"hsla(var(--swatch-border-default), 1)",
										backgroundColor: backgroundColor || "transparent",
									}}
								>
									<Type
										className="w-4 h-4"
										strokeWidth={2.5}
										style={{
											color:
												textAndBorderColor ||
												"hsla(var(--swatch-border-default), 1)",
										}}
									/>
								</span>
							</div>
						</TooltipTrigger>
						<TooltipContent>Color</TooltipContent>
					</Tooltip>
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-fit px-1.5 py-2">
				<div className="flex flex-col gap-2">
					{colorSections.map((section) => (
						<div key={section.key} className="flex flex-col gap-1">
							<p className="px-1 py-0.5 text-xs font-medium text-muted-foreground">
								{section.title}
							</p>
							<div className="grid grid-cols-5 grid-rows-2 gap-0.5">
								{section.colors.map((c) => (
									<ColorButton
										key={c.color}
										hsl={c.hsl}
										editor={editor}
										color={c.color}
										bgColor={c.bgColor}
										tooltipText={c.tooltipText}
										buttonType={section.buttonType}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default React.memo(ColorButtonMenu);
