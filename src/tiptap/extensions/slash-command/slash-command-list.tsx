import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
	KeyDownRef,
	SlashCommandGroupCommandsProps,
	SlashCommandGroupProps,
} from "@/tiptap/types";

const SlashCommandList = forwardRef<
	KeyDownRef,
	{
		items: SlashCommandGroupProps[];
		command: (item: SlashCommandGroupCommandsProps) => void;
	}
>(({ items, command }, ref) => {
	const flatItems: SlashCommandGroupCommandsProps[] = items.flatMap(
		(group) => group.commands,
	);
	const [selectedIndex, setSelectedIndex] = useState(0);

	useImperativeHandle(ref, () => ({
		onKeyDown({ event }: { event: KeyboardEvent }) {
			if (event.key === "ArrowUp") {
				upHandler();
				return true;
			}

			if (event.key === "ArrowDown") {
				downHandler();
				return true;
			}

			if (event.key === "Enter") {
				enterHandler();
				return true;
			}

			return false;
		},
	}));

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when items update
	useEffect(() => {
		setSelectedIndex(0);
	}, [items]);

	const upHandler = () => {
		if (!flatItems.length) return;
		setSelectedIndex(
			(prev) => (prev + flatItems.length - 1) % flatItems.length,
		);
	};

	const downHandler = () => {
		if (!flatItems.length) return;
		setSelectedIndex((prev) => (prev + 1) % flatItems.length);
	};

	const enterHandler = () => {
		if (!flatItems.length) return;
		selectItem(selectedIndex);
	};

	const selectItem = (index: number) => {
		const item = flatItems[index];
		if (item) {
			command(item);
		}
	};

	return (
		<ScrollArea
			role="menu"
			aria-label="Command menu"
			className="w-[220px] h-[340px] bg-popover border border-border shadow rounded-2xl relative z-50"
		>
			<div className="flex flex-col gap-2 p-2.5">
				{items.length > 0 ? (
					items.map((group, groupIndex) => (
						<div key={group.key} className="flex flex-col gap-2">
							<div className="w-full items-start flex flex-col gap-1">
								<p className="px-1 py-0.5 text-xs font-medium text-muted-foreground">
									{group.title}
								</p>

								{group.commands.map((item, index) => {
									const globalIndex =
										items
											.slice(0, groupIndex)
											.reduce((acc, g) => acc + g.commands.length, 0) + index;
									const ItemIcon = item.icon;

									return (
										<button
											type="button"
											key={item.key}
											className={cn(
												"w-full h-8 rounded-lg flex gap-1.5 items-center p-2 bg-transparent hover:bg-accent cursor-pointer text-muted-foreground transition-all",
												selectedIndex === globalIndex
													? "bg-accent text-primary"
													: "hover:text-foreground",
											)}
											onClick={() => selectItem(globalIndex)}
										>
											<div>
												<ItemIcon className="w-4 h-4" strokeWidth={2.5} />
											</div>

											<span className="text-sm">{item.title}</span>
										</button>
									);
								})}
							</div>

							{groupIndex !== items.length - 1 && <Separator />}
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">{"No results"}</p>
				)}
			</div>
		</ScrollArea>
	);
});

export default SlashCommandList;
