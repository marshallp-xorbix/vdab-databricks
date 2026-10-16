import type { FC } from "react";
import type { VdabCanvasRendererProps } from "../../../types/vdabCanvasRendererProps";

interface FileUploadProps {
  label?: string;
}

const FileUploadRenderer: FC<VdabCanvasRendererProps> = ({ component }) => {
  const props = component.props as FileUploadProps;
  const label = props.label || "Upload File";

  const volumeBinding = component.bindings?.databricksVolume;
  const resource = volumeBinding?.source?.resource;
  const hasVolumeBinding =
    resource != null &&
    typeof resource.catalog === "string" &&
    typeof resource.schema === "string" &&
    typeof resource.volume === "string";

  return (
    <div className="p-4 border-2 border-gray-200 rounded">
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-gray-700">{label}</label>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
          <div className="text-gray-400 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="text-sm text-gray-600">
            Click to upload or drag and drop
          </div>
        </div>

        {hasVolumeBinding && resource ? (
          <div className="text-xs text-success font-medium">
            Uploads to: {resource.catalog}.{resource.schema}.{resource.volume}
            {resource.filePath && `/${resource.filePath}`}
          </div>
        ) : null}
        {!hasVolumeBinding && (
          <div className="text-xs text-warning font-medium">
            No volume binding configured
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadRenderer;
