import type { Editor } from "@tiptap/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { commandGroups } from "@/tiptap/constants";

interface TransformIntoButtonMenuProps {
	editor: Editor;
}

const TransformIntoButtonMenu = ({ editor }: TransformIntoButtonMenuProps) => {
	const [menuOpened, setMenuOpened] = useState(false);

	const getActiveNodeName = useCallback(
		() => editor.state.selection.$head.parent.type.name,
		[editor],
	);
	const [activeNodeName, setActiveNodeName] = useState(getActiveNodeName);

	useEffect(() => {
		const update = () => setActiveNodeName(getActiveNodeName());
		editor.on("selectionUpdate", update);
		editor.on("transaction", update);
		return () => {
			editor.off("selectionUpdate", update);
			editor.off("transaction", update);
		};
	}, [editor, getActiveNodeName]);

	const transformOptions = useMemo(
		() => commandGroups.flatMap((group) => group.commands),
		[],
	);

	const handleTransform = useCallback(
		(
			command: (args: {
				editor: Editor;
				range: { from: number; to: number };
			}) => void,
		) => {
			const { from, to } = editor.state.selection;
			command({ editor, range: { from, to } });
			setMenuOpened(false);
		},
		[editor],
	);

	return (
		<Popover open={menuOpened} onOpenChange={setMenuOpened}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					aria-label="Transform into menu"
					className="w-full justify-start text-muted-foreground hover:text-foreground px-2.5"
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<p className="w-full capitalize text-sm">{activeNodeName}</p>
						</TooltipTrigger>
						<TooltipContent>Transform into</TooltipContent>
					</Tooltip>
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-fit px-1.5 py-2">
				<div className="flex flex-col gap-1">
					<p className="text-xs font-semibold leading-normal capitalize text-foreground px-2">
						{"Turn into"}
					</p>

					<div className="flex flex-col gap-0.5">
						{transformOptions.map((node) => {
							const NodeIcon = node.icon;

							return (
								<Button
									key={node.key}
									type="button"
									size="sm"
									variant="ghost"
									data-active={false}
									className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground data-[active=true]:font-medium data-[active=true]:bg-accent data-[active=true]:text-primary data-[active=true]:hover:bg-accent"
									onClick={() => handleTransform(node.command)}
								>
									<NodeIcon className="w-4 h-4" strokeWidth={2.5} />
									<p className="text-sm font-normal leading-normal capitalize">
										{node.title}
									</p>
								</Button>
							);
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default React.memo(TransformIntoButtonMenu);
