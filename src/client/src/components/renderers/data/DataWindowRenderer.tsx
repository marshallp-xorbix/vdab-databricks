import type { FC } from "react";
import type { UnityCatalogColumn } from "../../../types/components/bindings";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";
import StreamlitDataframeGrid from "./StreamlitDataframeGrid";

interface DataWindowProps {
  label: string;
  maxRows: number;
  scrollable: boolean;
  placeholder: string | null;
  width: "stretch" | "content";
  hideIndex: boolean | null;
  height: "auto" | "content" | "stretch";
}

const DataWindowRenderer: FC<VdabCanvasRendererProps> = ({
  component,
  theme,
}) => {
  const props = component.props as DataWindowProps;

  const textColor = theme.textColor;
  const secondaryBg = theme.secondaryBackgroundColor;

  const label = props.label;
  const maxRows = props.maxRows;

  let catalog: string | undefined;
  let schema: string | undefined;
  let table: string | undefined;
  let columns: UnityCatalogColumn[] = [];
  let usesLakebase = false;

  if (component.bindings?.lakebaseProvisionedDatabase) {
    const binding = component.bindings.lakebaseProvisionedDatabase;
    catalog = binding.source?.resource?.catalog;
    schema = binding.source?.resource?.schema;
    table = binding.source?.resource?.table;
    columns = (binding.source?.resource?.columns as UnityCatalogColumn[]) || [];
    usesLakebase = true;
  } else if (component.bindings?.lakebaseAutoscaling) {
    const binding = component.bindings.lakebaseAutoscaling;
    catalog = binding.source?.resource?.catalog;
    schema = binding.source?.resource?.schema;
    table = binding.source?.resource?.table;
    columns = (binding.source?.resource?.columns as UnityCatalogColumn[]) || [];
    usesLakebase = true;
  } else if (component.bindings?.unityCatalogTable) {
    const binding = component.bindings.unityCatalogTable;
    catalog = binding.source?.resource?.catalog;
    schema = binding.source?.resource?.schema;
    table = binding.source?.resource?.table;
    columns = (binding.source?.resource?.columns as UnityCatalogColumn[]) || [];
  }

  const tableReference =
    catalog && schema && table ? `${catalog}.${schema}.${table}` : null;

  const displayColumns = columns
    .map((column) => ({
      name: column.name ?? "",
    }))
    .filter((column) => column.name.length > 0);

  return (
    <div className="w-full" style={{ color: textColor }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium" style={{ color: textColor }}>
          {label}
        </h3>
        <p
          className="text-xs opacity-80 text-right truncate"
          style={{ color: textColor }}
        >
          {tableReference
            ? `${usesLakebase ? "Lakebase" : "Unity Catalog"}: ${tableReference}`
            : usesLakebase
              ? "Lakebase Data Preview"
              : "Unity Catalog Data Preview"}
        </p>
      </div>

      <StreamlitDataframeGrid
        columns={displayColumns}
        maxRows={maxRows}
        scrollable={props.scrollable}
        width={props.width}
        height={props.height}
        hideIndex={props.hideIndex}
        placeholder={props.placeholder}
        textColor={textColor}
        secondaryBackgroundColor={secondaryBg}
      />

      <div className="mt-1 text-xs opacity-80" style={{ color: textColor }}>
        Preview only (schema-based)
      </div>
    </div>
  );
};

export default DataWindowRenderer;
