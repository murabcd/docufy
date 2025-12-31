import type * as React from "react";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

type TitleEditInputProps = {
	value: string;
	onValueChange: (value: string) => void;
	onCommit: () => void;
	onCancel: () => void;
	autoFocus?: boolean;
	inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function TitleEditInput({
	value,
	onValueChange,
	onCommit,
	onCancel,
	autoFocus = false,
	inputRef,
}: TitleEditInputProps) {
	const fallbackRef = useRef<HTMLInputElement>(null);
	const ref = inputRef ?? fallbackRef;

	useEffect(() => {
		if (!autoFocus) return;
		const handle = requestAnimationFrame(() => {
			const element = ref.current;
			if (!element) return;
			element.focus();
			element.setSelectionRange(0, element.value.length);
		});
		return () => cancelAnimationFrame(handle);
	}, [autoFocus, ref]);

	return (
		<Input
			ref={ref as React.Ref<HTMLInputElement>}
			value={value}
			onChange={(e) => onValueChange(e.target.value)}
			onBlur={() => onCommit()}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					onCommit();
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					onCancel();
				}
			}}
		/>
	);
}
