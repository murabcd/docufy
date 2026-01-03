"use client";

import type { ToolCallPart, ToolCallState } from "@tanstack/ai-client";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolApproval = ToolCallPart["approval"];

type ConfirmationContextValue = {
	approval: ToolApproval;
	state: ToolCallState;
};

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
	null,
);

const useConfirmation = () => {
	const context = useContext(ConfirmationContext);

	if (!context) {
		throw new Error("Confirmation components must be used within Confirmation");
	}

	return context;
};

export type ConfirmationProps = ComponentProps<typeof Alert> & {
	approval?: ToolApproval;
	state: ToolCallState;
};

export const Confirmation = ({
	className,
	approval,
	state,
	...props
}: ConfirmationProps) => {
	if (
		!approval ||
		state === "awaiting-input" ||
		state === "input-streaming" ||
		state === "input-complete"
	) {
		return null;
	}

	return (
		<ConfirmationContext.Provider value={{ approval, state }}>
			<Alert
				className={cn("flex flex-col gap-2.5 py-2 px-3", className)}
				{...props}
			/>
		</ConfirmationContext.Provider>
	);
};

export type ConfirmationTitleProps = ComponentProps<typeof AlertDescription>;

export const ConfirmationTitle = ({
	className,
	...props
}: ConfirmationTitleProps) => (
	<AlertDescription className={cn("inline text-xs", className)} {...props} />
);

export type ConfirmationRequestProps = {
	children?: ReactNode;
};

export const ConfirmationRequest = ({ children }: ConfirmationRequestProps) => {
	const { state } = useConfirmation();

	// Only show when approval is requested
	if (state !== "approval-requested") {
		return null;
	}

	return children;
};

export type ConfirmationAcceptedProps = {
	children?: ReactNode;
};

export const ConfirmationAccepted = ({
	children,
}: ConfirmationAcceptedProps) => {
	const { approval, state } = useConfirmation();

	// Only show when approved and in response states
	if (!approval?.approved || state !== "approval-responded") {
		return null;
	}

	return children;
};

export type ConfirmationRejectedProps = {
	children?: ReactNode;
};

export const ConfirmationRejected = ({
	children,
}: ConfirmationRejectedProps) => {
	const { approval, state } = useConfirmation();

	// Only show when rejected and in response states
	if (approval?.approved !== false || state !== "approval-responded") {
		return null;
	}

	return children;
};

export type ConfirmationActionsProps = ComponentProps<"div">;

export const ConfirmationActions = ({
	className,
	...props
}: ConfirmationActionsProps) => {
	const { state } = useConfirmation();

	// Only show when approval is requested
	if (state !== "approval-requested") {
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center justify-end gap-1.5 self-end",
				className,
			)}
			{...props}
		/>
	);
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = (props: ConfirmationActionProps) => (
	<Button className="h-7 px-2 text-xs" type="button" {...props} />
);
