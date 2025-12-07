import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji";
import Suggestion from "@tiptap/suggestion";
import TiptapEmojiSuggestion from "./tiptap-emoji-suggestion";

const TiptapEmoji = Emoji.configure({
	emojis: gitHubEmojis,
	enableEmoticons: true,
	forceFallbackImages: false,
	suggestion: TiptapEmojiSuggestion,
}).extend({
	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
				decorationClass: "tiptap-slash-highlight",
			}),
		];
	},
});

export default TiptapEmoji;
