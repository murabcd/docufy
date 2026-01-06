import { chat } from "@tanstack/ai";
import { openai } from "@tanstack/ai-openai";
import { MEMORY_CANDIDATE_EXTRACTOR_SYSTEM_PROMPT } from "./prompts";

const OPENAI_CHAT_MODEL = "gpt-4.1-nano";
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

type MemoryCandidateResult = {
	fact: string | null;
	confidence: number;
	allowed: boolean;
};

export const embedText = async (text: string): Promise<number[]> => {
	const adapter = openai();
	const result = await adapter.createEmbeddings({
		model: OPENAI_EMBEDDING_MODEL,
		input: text,
	});

	const vector = result.embeddings?.[0];
	if (!Array.isArray(vector)) {
		throw new Error("Embedding result missing embedding vector");
	}

	return vector;
};

const parseCandidate = (raw: unknown): MemoryCandidateResult => {
	if (!raw || typeof raw !== "object") {
		return { fact: null, confidence: 0, allowed: false };
	}
	const record = raw as Record<string, unknown>;
	const fact = typeof record.fact === "string" ? record.fact : null;
	const confidence =
		typeof record.confidence === "number" ? record.confidence : 0;
	const allowed = typeof record.allowed === "boolean" ? record.allowed : false;
	const trimmed = fact?.trim() ?? "";
	return {
		fact: trimmed ? trimmed : null,
		confidence: Number.isFinite(confidence) ? confidence : 0,
		allowed,
	};
};

export const extractMemoryCandidate = async (
	messageText: string,
): Promise<MemoryCandidateResult> => {
	const input = messageText.trim();
	if (!input) return { fact: null, confidence: 0, allowed: false };

	let content = "";

	try {
		const adapter = openai();
		const stream = chat({
			adapter,
			model: OPENAI_CHAT_MODEL,
			systemPrompts: [MEMORY_CANDIDATE_EXTRACTOR_SYSTEM_PROMPT],
			messages: [{ role: "user", content: input }],
		});

		for await (const chunk of stream as AsyncIterable<{
			type: string;
			content?: string;
		}>) {
			if (chunk.type === "content" && typeof chunk.content === "string") {
				content = chunk.content;
			}
		}
	} catch {
		return { fact: null, confidence: 0, allowed: false };
	}

	if (!content.trim()) return { fact: null, confidence: 0, allowed: false };

	try {
		const parsed = JSON.parse(content) as unknown;
		return parseCandidate(parsed);
	} catch {
		return { fact: null, confidence: 0, allowed: false };
	}
};
