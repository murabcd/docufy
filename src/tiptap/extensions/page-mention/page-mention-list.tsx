import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { KeyDownRef } from "@/tiptap/types";
import type { PageMentionItem } from "./page-mention-suggestion";

const PageMentionList = forwardRef<
	KeyDownRef,
	{
		items: PageMentionItem[];
		command: (item: PageMentionItem) => void;
	}
>(({ items, command }, ref) => {
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
		if (!items.length) return;
		setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
	};

	const downHandler = () => {
		if (!items.length) return;
		setSelectedIndex((prev) => (prev + 1) % items.length);
	};

	const enterHandler = () => {
		if (!items.length) return;
		selectItem(selectedIndex);
	};

	const selectItem = (index: number) => {
		const item = items[index];
		if (item) {
			command(item);
		}
	};

	return (
		<ScrollArea className="w-[260px] max-h-[340px] bg-popover border border-border shadow rounded-2xl relative z-50">
			<div className="w-full flex flex-col gap-1 p-2.5">
				{items.length > 0 ? (
					items.map((item, index) => (
						<button
							type="button"
							key={item.documentId}
							className={cn(
								"w-full h-8 rounded-lg flex items-center px-2 bg-transparent hover:bg-accent cursor-pointer text-muted-foreground transition-all",
								selectedIndex === index
									? "bg-accent text-primary"
									: "hover:text-foreground",
							)}
							onClick={() => selectItem(index)}
						>
							<span className="text-sm truncate">{item.title}</span>
						</button>
					))
				) : (
					<p className="text-muted-foreground text-sm">{"No results"}</p>
				)}
			</div>
		</ScrollArea>
	);
});

export default PageMentionList;
