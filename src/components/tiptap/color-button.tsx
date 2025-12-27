import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ColorButtonProps } from "@/tiptap/types";
import ColorIcon from "./color-icon";

const ColorButton = ({
	editor,
	buttonType,
	hsl,
	color,
	bgColor,
	tooltipText,
	tooltipDisabled = false,
}: ColorButtonProps) => {
	const isActive =
		buttonType === "text"
			? editor.getAttributes("textStyle")?.color === hsl
			: editor.getAttributes("highlight")?.color === hsl;

	const handlePress = useCallback(() => {
		if (buttonType === "text") {
			if (isActive) {
				editor.commands.unsetColor();
			} else {
				editor.commands.setColor(hsl);
			}
		} else {
			editor.commands.toggleHighlight({ color: hsl });
		}
	}, [editor, buttonType, hsl, isActive]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					aria-label={tooltipText}
					data-active={isActive}
					className="text-muted-foreground data-[active=true]:bg-accent data-[active=true]:hover:bg-accent"
					onClick={handlePress}
				>
					<ColorIcon color={color} bgColor={bgColor} buttonType={buttonType} />
				</Button>
			</TooltipTrigger>
			{tooltipDisabled ? null : <TooltipContent>{tooltipText}</TooltipContent>}
		</Tooltip>
	);
};

export default React.memo(ColorButton);
