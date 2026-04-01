import { Button } from "./Button";

interface FolderPickerProps {
	directorySupported: boolean;
	onPickDirectory: () => void;
	onReset?: () => void;
	busy?: boolean;
	detail?: string;
	unsupportedHint?: string;
	stage?: "import" | "viewer";
	className?: string;
}

export function FolderPicker({
	directorySupported,
	onPickDirectory,
	onReset,
	busy,
	detail,
	unsupportedHint,
	stage = "import",
	className,
}: FolderPickerProps) {
	const compact = stage === "viewer";

	return (
		<section
			className={[
				"rounded border border-slate-800 bg-slate-950/70",
				compact ? "p-3" : "p-4",
				className ?? "",
			]
				.join(" ")
				.trim()}
			data-stage={stage}
		>
			<div className="space-y-1">
				<h1
					className={
						compact
							? "text-sm font-semibold text-slate-100"
							: "text-lg font-semibold text-slate-100"
					}
				>
					Dental X-Ray Viewer
				</h1>
				<p className="text-sm text-slate-400">
					Open a GALILEOS scan folder locally. Browser parsing only.
				</p>
				{detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
				{!directorySupported && unsupportedHint ? (
					<p className="text-xs text-amber-300">{unsupportedHint}</p>
				) : null}
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<Button
					variant="primary"
					onClick={onPickDirectory}
					disabled={busy || !directorySupported}
				>
					{directorySupported ? "Open folder" : "Directory API unavailable"}
				</Button>
				{onReset ? (
					<Button variant="ghost" onClick={onReset} disabled={busy}>
						Reset
					</Button>
				) : null}
			</div>
		</section>
	);
}
