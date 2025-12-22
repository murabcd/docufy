import { EmojiPicker } from "@ferrucc-io/emoji-picker";
import type React from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

type IconPickerProps = {
	onChange: (icon: string) => void;
	children: React.ReactNode;
	asChild?: boolean;
};

export function IconPicker({ onChange, children, asChild }: IconPickerProps) {
	const handleEmojiSelect = (emoji: string) => {
		onChange(emoji);
	};

	return (
		<Popover>
			<PopoverTrigger asChild={asChild}>{children}</PopoverTrigger>
			<PopoverContent className="w-auto p-0 border-none shadow-none">
				<EmojiPicker
					className="border border-zinc-200 dark:border-zinc-800 rounded-lg"
					emojisPerRow={12}
					emojiSize={28}
					onEmojiSelect={handleEmojiSelect}
				>
					<EmojiPicker.Header className="p-2 pb-0">
						<EmojiPicker.Input
							placeholder="Search emoji"
							autoFocus={true}
							className="focus:ring-2 focus:ring-inset ring-1 ring-transparent"
						/>
					</EmojiPicker.Header>
					<EmojiPicker.Group>
						<EmojiPicker.List hideStickyHeader={true} containerHeight={350} />
					</EmojiPicker.Group>
				</EmojiPicker>
			</PopoverContent>
		</Popover>
	);
}
