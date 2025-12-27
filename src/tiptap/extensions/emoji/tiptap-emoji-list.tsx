import type { EmojiItem } from "@tiptap/extension-emoji";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import type { KeyDownRef } from "@/tiptap/types";

const EmojiList = forwardRef<
	KeyDownRef,
	{
		items: EmojiItem[];
		command: (item: EmojiItem) => void;
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
		<div className="w-full max-w-[250px] max-h-[500px] bg-popover border border-border shadow rounded-2xl flex flex-col gap-1 p-2.5 relative overflow-hidden">
			<div className="w-full flex flex-col gap-1 overflow-y-auto">
				{items.length > 0 ? (
					items.map((item, index) => (
						<button
							type="button"
							key={item.name}
							className={cn(
								"w-full h-7 rounded-lg flex gap-1.5 items-center p-2 bg-transparent hover:bg-accent cursor-pointer text-muted-foreground transition-all",
								selectedIndex === index
									? "bg-accent text-primary"
									: "hover:text-foreground",
							)}
							data-emoji-name={item.name}
							onClick={() => selectItem(index)}
						>
							{item.fallbackImage ? (
								<img
									src={item.fallbackImage}
									width={20}
									height={20}
									alt={item.emoji}
								/>
							) : (
								item.emoji
							)}{" "}
							<span
								title={item.name}
								className="text-sm text-ellipsis overflow-hidden"
							>
								{item.name}
							</span>
						</button>
					))
				) : (
					<p className="text-muted-foreground text-sm">{"No results"}</p>
				)}
			</div>
		</div>
	);
});

export default EmojiList;
