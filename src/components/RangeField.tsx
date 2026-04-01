import type { InputHTMLAttributes } from "react";

interface RangeFieldProps
	extends Omit<
		InputHTMLAttributes<HTMLInputElement>,
		"type" | "value" | "min" | "max" | "onChange"
	> {
	label: string;
	value: number;
	min: number;
	max: number;
	hint?: string;
	onChange: (value: number) => void;
	onCommit?: (value: number) => void;
}

export function RangeField({
	label,
	value,
	min,
	max,
	hint,
	onChange,
	onCommit,
	className,
	...props
}: RangeFieldProps) {
	const commitValue = (next: number) => {
		onCommit?.(next);
	};

	return (
		<div className={className}>
			<div className="flex items-center justify-between text-xs text-slate-400">
				<span>{label}</span>
				<span className="font-medium text-slate-200">{value}</span>
			</div>
			<input
				className="mt-1 w-full accent-sky-400"
				type="range"
				min={min}
				max={max}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				onPointerUp={(event) => commitValue(Number(event.currentTarget.value))}
				onPointerCancel={(event) =>
					commitValue(Number(event.currentTarget.value))
				}
				onKeyUp={(event) =>
					commitValue(Number((event.currentTarget as HTMLInputElement).value))
				}
				onBlur={(event) => commitValue(Number(event.currentTarget.value))}
				{...props}
			/>
			{hint ? (
				<p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p>
			) : null}
		</div>
	);
}
