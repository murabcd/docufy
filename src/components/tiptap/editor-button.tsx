import { AtSign } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { EditorButtonProps } from "@/tiptap/types";

const EditorButton = ({
	editor,
	buttonKey,
	tooltipText,
	isIconOnly = false,
	variant = "ghost",
	isDisabled = false,
	icon = AtSign,
	className,
	iconClass,
	text = "Button",
	withActive = false,
	onPressed,
}: EditorButtonProps) => {
	const [isActive, setIsActive] = useState(() => editor.isActive(buttonKey));
	const IconComponent = icon;

	useEffect(() => {
		const update = () => setIsActive(editor.isActive(buttonKey));
		editor.on("selectionUpdate", update);
		editor.on("transaction", update);
		return () => {
			editor.off("selectionUpdate", update);
			editor.off("transaction", update);
		};
	}, [editor, buttonKey]);

	const handlePress = useCallback(() => {
		onPressed?.();
	}, [onPressed]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					size={isIconOnly ? "icon-sm" : "sm"}
					variant={variant}
					disabled={isDisabled}
					data-active={withActive ? isActive : false}
					className={cn(
						"text-muted-foreground hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-primary data-[active=true]:hover:bg-accent",
						className,
					)}
					onClick={handlePress}
				>
					{isIconOnly && IconComponent ? (
						<IconComponent
							className={cn("w-4 h-4", iconClass)}
							strokeWidth={2.5}
						/>
					) : (
						text
					)}
				</Button>
			</TooltipTrigger>
			{tooltipText ? <TooltipContent>{tooltipText}</TooltipContent> : null}
		</Tooltip>
	);
};

export default React.memo(EditorButton);
