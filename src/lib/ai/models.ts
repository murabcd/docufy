export interface ChatModel {
	id: string;
	name: string;
	model: string;
}

export const chatModels: Array<ChatModel> = [
	{
		id: "auto",
		name: "Auto",
		model: "gpt-4.1-mini",
	},
	{
		id: "gpt-4.1",
		name: "GPT-4.1",
		model: "gpt-4.1",
	},
	{
		id: "gpt-4.1-mini",
		name: "GPT-4.1-mini",
		model: "gpt-4.1-mini",
	},
	{
		id: "gpt-4.1-nano",
		name: "GPT-4.1-nano",
		model: "gpt-4.1-nano",
	},
] as const;

export const DEFAULT_CHAT_MODEL = "auto";
