import DragHandle from "@tiptap/extension-drag-handle-react";
import type { Node } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import {
	Clipboard,
	Copy,
	GripVertical,
	PaintBucket,
	Plus,
	Replace,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { colorSections, commandGroups } from "@/tiptap/constants";
import {
	canResetFormatting,
	canShowColorTransform,
	canShowNodeTransform,
	copyNodeTextContent,
	deleteNode,
	duplicateNode,
	isUploadingImage,
	nodeHasTextContent,
	removeAllFormatting,
	transformNodeToAlternative,
} from "@/tiptap/helpers";
import ColorIcon from "./color-icon";

const excludedCommands = ["imageUploader"];

const formattedTransformOptions = commandGroups
	.flatMap((group) => group.commands)
	.filter((command) => !excludedCommands.includes(command.key));

const DRAG_HANDLE_POSITION_CONFIG = { placement: "left" as const };

const iconProps = { className: "w-4 h-4", strokeWidth: 2.5 } as const;

const TiptapDragHandle = memo(({ editor }: { editor: Editor }) => {
	const [currentNodePos, setCurrentNodePos] = useState<number>(-1);
	const [dropdownOpened, setDropdownOpened] = useState<boolean>(false);
	const [editorVersion, setEditorVersion] = useState(0);

	useEffect(() => {
		const onUpdate = () => setEditorVersion((v) => v + 1);
		editor.on("selectionUpdate", onUpdate);
		editor.on("transaction", onUpdate);

		return () => {
			editor.off("selectionUpdate", onUpdate);
			editor.off("transaction", onUpdate);
		};
	}, [editor]);

	const handleNodeChange = useCallback(
		({ pos }: { editor: Editor; node: Node | null; pos: number }) => {
			setCurrentNodePos(pos);
		},
		[],
	);

	const selectCurrentNode = useCallback(() => {
		const { state, view } = editor;

		const selection = window.getSelection();
		if (selection && !selection.isCollapsed) {
			selection.removeAllRanges();
		}

		const transaction = state.tr.setSelection(
			NodeSelection.create(state.doc, currentNodePos),
		);

		view.dispatch(transaction);
	}, [editor, currentNodePos]);

	const addSlashParagraphAfterCurrentBlock = useCallback(
		(editor: Editor, currentNodePos: number) => {
			const resolvedPos = editor.state.doc.resolve(currentNodePos);
			const blockNode = resolvedPos.nodeAfter || resolvedPos.parent;

			const blockEnd = currentNodePos + blockNode.nodeSize;

			editor
				.chain()
				.focus(blockEnd, { scrollIntoView: true })
				.insertContentAt(blockEnd, {
					type: "paragraph",
					content: [{ type: "text", text: "/" }],
				})
				.setTextSelection(blockEnd + 2)
				.run();
		},
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: recompute based on editor state
	const canShowColor = useMemo(
		() => canShowColorTransform(editor),
		[dropdownOpened, editorVersion],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: recompute based on editor state
	const canShowTransform = useMemo(
		() => canShowNodeTransform(editor),
		[dropdownOpened, editorVersion],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: recompute based on editor state
	const canShowResetFormatting = useMemo(
		() => canResetFormatting(editor),
		[dropdownOpened, editorVersion],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: recompute based on editor state
	const canCopyToClipboard = useMemo(
		() => nodeHasTextContent(editor),
		[dropdownOpened, editorVersion],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: recompute based on editor state
	const isUploading = useMemo(
		() => isUploadingImage(editor.state),
		[dropdownOpened, editorVersion],
	);

	return (
		<DragHandle
			editor={editor}
			computePositionConfig={DRAG_HANDLE_POSITION_CONFIG}
			onNodeChange={handleNodeChange}
		>
			<div className="flex items-center pr-3">
				<button
					type="button"
					className="w-6 h-8 rounded-2xl flex justify-center items-center px-0 py-2 bg-transparent hover:bg-accent cursor-grab text-muted-foreground hover:text-foreground transition-all"
					onClick={() =>
						addSlashParagraphAfterCurrentBlock(editor, currentNodePos)
					}
				>
					<Plus {...iconProps} />
				</button>

				<DropdownMenu open={dropdownOpened} onOpenChange={setDropdownOpened}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="w-6 h-8 rounded-2xl flex justify-center items-center px-0 py-2 bg-transparent hover:bg-accent cursor-grab text-muted-foreground hover:text-foreground transition-all"
							onClick={selectCurrentNode}
						>
							<GripVertical {...iconProps} />
						</button>
					</DropdownMenuTrigger>

					<DropdownMenuContent side="right" align="start" className="w-[220px]">
						<DropdownMenuSub>
							<DropdownMenuSubTrigger disabled={!canShowColor}>
								<PaintBucket {...iconProps} />
								Color
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className="w-[220px] p-0 overflow-hidden">
								<ScrollArea className="w-[220px] h-[340px]">
									<div className="p-1">
										{colorSections.map((section, sectionIndex) => (
											<div key={section.key}>
												<DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
													{section.title}
												</DropdownMenuLabel>
												{section.colors.map((el) => (
													<DropdownMenuItem
														key={`${section.key}_${el.color}`}
														onSelect={() => {
															if (section.key === "text") {
																editor.chain().focus().setColor(el.hsl).run();
															} else if (section.key === "highlight") {
																editor
																	.chain()
																	.focus()
																	.setHighlight({ color: el.hsl })
																	.run();
															}
															setDropdownOpened(false);
														}}
													>
														<ColorIcon
															buttonType={section.buttonType}
															color={el.color}
															bgColor={el.bgColor}
														/>
														{el.tooltipText}
													</DropdownMenuItem>
												))}
												{sectionIndex !== colorSections.length - 1 ? (
													<DropdownMenuSeparator />
												) : null}
											</div>
										))}
									</div>
								</ScrollArea>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuSub>
							<DropdownMenuSubTrigger disabled={!canShowTransform}>
								<Replace className="w-4 h-4" strokeWidth={2.5} />
								Transform into
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className="w-[220px] p-0 overflow-hidden">
								<ScrollArea className="w-[220px] h-[340px]">
									<div className="p-1">
										{formattedTransformOptions.map((node) => {
											const NodeIcon = node.icon;
											return (
												<DropdownMenuItem
													key={node.key}
													onSelect={() => {
														transformNodeToAlternative(editor, node);
														setDropdownOpened(false);
													}}
												>
													<NodeIcon {...iconProps} />
													{node.title}
												</DropdownMenuItem>
											);
										})}
									</div>
								</ScrollArea>
							</DropdownMenuSubContent>
						</DropdownMenuSub>

						<DropdownMenuItem
							disabled={!canShowResetFormatting}
							onSelect={() => {
								if (!canShowResetFormatting) return;
								removeAllFormatting(editor);
								setDropdownOpened(false);
							}}
						>
							<RotateCcw {...iconProps} />
							Reset formatting
						</DropdownMenuItem>

						<DropdownMenuItem
							disabled={isUploading}
							onSelect={() => {
								duplicateNode(editor);
								setDropdownOpened(false);
							}}
						>
							<Copy {...iconProps} />
							Duplicate block
						</DropdownMenuItem>

						<DropdownMenuItem
							disabled={!canCopyToClipboard}
							onSelect={() => {
								if (!canCopyToClipboard) return;
								copyNodeTextContent(editor);
								setDropdownOpened(false);
							}}
						>
							<Clipboard {...iconProps} />
							Copy to clipboard
						</DropdownMenuItem>
						<DropdownMenuSeparator />

						<DropdownMenuItem
							onSelect={() => {
								deleteNode(editor);
								setDropdownOpened(false);
							}}
							className="text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
						>
							<Trash2 className="text-destructive dark:text-red-500" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</DragHandle>
	);
});

TiptapDragHandle.displayName = "TiptapDragHandle";

export default TiptapDragHandle;
