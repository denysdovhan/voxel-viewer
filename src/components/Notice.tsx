import type { HTMLAttributes, ReactNode } from "react";

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
	compact?: boolean;
	children: ReactNode;
}

export function Notice({
	compact = false,
	className,
	children,
	...props
}: NoticeProps) {
	return (
		<div
			className={[
				"rounded border border-amber-500/30 bg-amber-500/10 text-amber-200",
				compact ? "px-2 py-2 text-[11px] leading-4" : "px-3 py-2 text-xs",
				className ?? "",
			]
				.join(" ")
				.trim()}
			{...props}
		>
			{children}
		</div>
	);
}
