import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type DocumentTitleProps = {
	title?: string;
	onTitleChange?: (title: string) => void | Promise<void>;
};

export function DocumentTitle({ title, onTitleChange }: DocumentTitleProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState(title ?? "Untitled");
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		if (!isEditing) {
			setValue(title ?? "Untitled");
		}
	}, [isEditing, title]);

	const commit = useCallback(() => {
		const normalized = value.trim() || "Untitled";
		if (normalized === (title ?? "Untitled")) {
			return;
		}
		setValue(normalized);
		onTitleChange?.(normalized);
	}, [onTitleChange, title, value]);

	const enterEdit = useCallback(() => {
		if (!onTitleChange) return;
		setIsEditing(true);
		setTimeout(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
		}, 0);
	}, [onTitleChange]);

	const exitEdit = useCallback(
		(commitChange: boolean) => {
			if (commitChange) {
				commit();
			} else {
				setValue(title ?? "Untitled");
			}
			setIsEditing(false);
		},
		[commit, title],
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault();
				exitEdit(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				exitEdit(false);
			}
		},
		[exitEdit],
	);

	const canEdit = !!onTitleChange;
	const displayValue = value || "Untitled";

	if (!canEdit) {
		return (
			<h1 className="text-4xl font-semibold tracking-tight leading-tight">
				{displayValue}
			</h1>
		);
	}

	return isEditing ? (
		<Input
			ref={inputRef}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={() => exitEdit(true)}
			onKeyDown={onKeyDown}
			className="h-auto! rounded-none! border-0! bg-transparent! dark:bg-transparent! px-0! py-0! text-4xl! md:text-4xl! font-semibold tracking-tight leading-tight shadow-none! focus-visible:ring-0! focus-visible:ring-offset-0!"
		/>
	) : (
		<button
			type="button"
			onClick={enterEdit}
			className="-mx-2 -my-1 w-full rounded px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
		>
			<h1 className="cursor-text text-4xl font-semibold tracking-tight leading-tight">
				{displayValue}
			</h1>
		</button>
	);
}
