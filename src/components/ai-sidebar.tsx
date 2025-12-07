import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import * as React from "react";
import { ChatInput } from "@/components/chat-input";
import { ChatMessages } from "@/components/chat-messages";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";

interface AISidebarProps {
	chatTitle?: string;
	onSend?: (message: string) => void;
	mentionTag?: string;
	attachmentLabel?: string;
	sourcesLabel?: string;
	placeholder?: string;
	children?: React.ReactNode;
}

export function AISidebar({
	chatTitle,
	onSend,
	mentionTag: _mentionTag,
	attachmentLabel,
	sourcesLabel,
	placeholder,
	children,
}: AISidebarProps) {
	const { setRightOpen } = useSidebar();
	const [inputValue, setInputValue] = React.useState("");

	const { messages, sendMessage, isLoading } = useChat({
		connection: fetchServerSentEvents("/api/chat"),
	});

	// Open right sidebar when component mounts
	React.useEffect(() => {
		setRightOpen(true);
	}, [setRightOpen]);

	const handleSend = () => {
		if (inputValue.trim() && !isLoading) {
			sendMessage(inputValue);
			setInputValue("");
			if (onSend) {
				onSend(inputValue);
			}
		}
	};

	return (
		<Sidebar
			side="right"
			collapsible="offcanvas"
			className="border-l flex flex-col"
		>
			<SidebarHeader className="flex flex-row items-center justify-between p-4">
				<div className="flex items-center gap-2">
					{chatTitle && <div className="text-sm font-medium">{chatTitle}</div>}
				</div>
			</SidebarHeader>
			<SidebarContent className="flex-1 overflow-y-auto p-4">
				{children || <ChatMessages messages={messages} isLoading={isLoading} />}
			</SidebarContent>
			<SidebarFooter className="p-4">
				<ChatInput
					value={inputValue}
					onChange={setInputValue}
					onSend={handleSend}
					placeholder={placeholder}
					attachmentLabel={attachmentLabel}
					sourcesLabel={sourcesLabel}
					disabled={isLoading}
				/>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
