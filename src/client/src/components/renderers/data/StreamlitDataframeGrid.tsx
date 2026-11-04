import {
	Table,
	TableHead,
	TableHeader,
	TableRow,
} from "../../ui/table";

interface StreamlitGridColumn {
	name: string;
}

interface StreamlitDataframeGridProps {
	columns: StreamlitGridColumn[];
	maxRows?: number;
	scrollable?: boolean;
	editable?: boolean;
	width?: "stretch" | "content";
	height?: "auto" | "content" | "stretch";
	hideIndex?: boolean | null;
	placeholder?: string | null;
	/** Falls back when canvas theme omits colors (e.g. new component). */
	textColor?: string;
	secondaryBackgroundColor?: string;
}

const toRgba = (hexOrColor: string | null | undefined, opacity: number): string => {
	if (hexOrColor == null || typeof hexOrColor !== "string") {
		return `rgba(226, 232, 240, ${opacity})`;
	}

	const trimmed = hexOrColor.trim();
	if (!trimmed.startsWith("#") || trimmed.length < 7) {
		return trimmed;
	}

	const r = parseInt(trimmed.slice(1, 3), 16);
	const g = parseInt(trimmed.slice(3, 5), 16);
	const b = parseInt(trimmed.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const StreamlitDataframeGrid = ({
	columns,
	width,
	height,
	hideIndex,
	placeholder,
	textColor = "#0f172a",
	secondaryBackgroundColor = "#e2e8f0",
}: StreamlitDataframeGridProps) => {
	const headerBackground = toRgba(secondaryBackgroundColor, 0.5);
	const streamlitSettings = [
		`width=${width ?? "stretch"}`,
		`height=${height ?? "auto"}`,
		`hide_index=${hideIndex === null || hideIndex === undefined ? "None" : String(hideIndex)}`,
		`placeholder=${placeholder === null || placeholder === undefined ? "None" : JSON.stringify(placeholder)}`,
	].join(" • ");

	return (
		<div className="border rounded-md overflow-hidden" style={{ borderColor: textColor }}>
			<Table>
				<TableHeader>
					<TableRow style={{ backgroundColor: headerBackground }}>
						{columns.length > 0 ? (
							columns.map((column) => (
								<TableHead key={column.name} style={{ color: textColor }}>
									<span className="text-xs font-medium">{column.name}</span>
								</TableHead>
							))
						) : (
							<TableHead className="h-9" />
						)}
					</TableRow>
				</TableHeader>
			</Table>
			<div className="border-t px-2 py-1 text-[11px] opacity-70" style={{ color: textColor }}>
				{streamlitSettings}
			</div>
		</div>
	);
};

export default StreamlitDataframeGrid;
