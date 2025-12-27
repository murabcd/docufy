import { Type } from "lucide-react";

const ColorIcon = ({
	color,
	bgColor,
	buttonType,
}: {
	buttonType: string;
	color?: string;
	bgColor?: string;
}) => {
	return (
		<span
			className="relative w-5 h-5 flex items-center justify-center border rounded-full transition-transform duration-200 ease-in-out"
			style={{
				borderColor: color
					? `hsla(var(${color}), 1)`
					: "hsla(var(--swatch-border-default), 1)",
				backgroundColor: bgColor ? `hsla(var(${bgColor}), 0.7)` : "transparent",
			}}
		>
			{buttonType === "text" ? (
				<Type
					className="w-4 h-4"
					strokeWidth={2.5}
					style={{
						color: `hsla(var(${color}), 1)`,
					}}
				/>
			) : null}
		</span>
	);
};

export default ColorIcon;
