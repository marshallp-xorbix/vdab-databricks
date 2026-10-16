using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Data;

/// <summary>
/// Service for FileUpload component
/// </summary>
public class FileUploadComponentService : BaseComponentService, IFileUploadComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.FileUpload;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new FileUploadComponentDto
        {
            Id = "template-file-upload",
            CodeName = "templateFileUpload",
            Type = ComponentType.FileUpload,
            Category = ComponentCategory.Data,
            Icon = "Upload",
            SchemaVersion = 1,
            Props = new FileUploadProps
            {
                Label = "Upload File"
            },
            SupportedBindings = new List<string> { "databricksVolume" },
            SupportedEvents = new List<string> { "onChange" }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        FileUploadComponentDto fileUpload = (FileUploadComponentDto)component;

        string varName = GetVariableName(component);
        string label = fileUpload.Props.Label ?? "Upload File";
        string codeName = component.CodeName?.Trim() ?? varName;
        string uploaderKey = $"{varName}_uploader";
        string processedFileKey = $"{varName}_processed_signatures";
        string uploadedFilesKey = $"{varName}_uploaded_files";

        // Extract volume info from bindings
        string? catalog = null;
        string? schema = null;
        string? volume = null;
        string? path = null;

        if (component.Bindings != null && component.Bindings.TryGetValue("databricksVolume", out BindingDto? binding))
        {
            if (binding.Source?.Resource != null)
            {
                catalog = binding.Source.Resource.Catalog;
                schema = binding.Source.Resource.Schema;
                volume = binding.Source.Resource.Volume;
                path = binding.Source.Resource.FilePath;
            }
        }

        // Construct volume path if all parts are provided
        string? volumePath = string.Empty;
        if (!string.IsNullOrWhiteSpace(catalog) && !string.IsNullOrWhiteSpace(schema) && !string.IsNullOrWhiteSpace(volume))
        {
            volumePath = $"/Volumes/{catalog}/{schema}/{volume}";
            if (!string.IsNullOrWhiteSpace(path))
            {
                // Ensure path starts with /
                path = path.TrimStart('/');
                volumePath = $"{volumePath}/{path}";
            }
        }

        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}# File upload component");
        sb.AppendLine($"{indentation}st.markdown(\"\"\"");
        sb.AppendLine($"{indentation}<style>");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone'],");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone'],");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader'] {");
        sb.AppendLine(indentation + "    border: 2px dashed #cbd5e1 !important;");
        sb.AppendLine(indentation + "    border-radius: 0.75rem !important;");
        sb.AppendLine(indentation + "    background: #f8fafc !important;");
        sb.AppendLine(indentation + "    min-height: 7.5rem;");
        sb.AppendLine(indentation + "    transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease, transform 160ms ease;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:hover,");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:focus-within,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:hover,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:focus-within,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:hover,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:focus-within {");
        sb.AppendLine(indentation + "    border-color: #60a5fa !important;");
        sb.AppendLine(indentation + "    background: #eff6ff !important;");
        sb.AppendLine(indentation + "    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.18);");
        sb.AppendLine(indentation + "    transform: translateY(-1px);");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone'].dragover,");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone'].is-dragover,");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone'][data-drag-active='true'],");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone'].dragover,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone'].is-dragover,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone'][data-drag-active='true'],");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader'].dragover,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader'].is-dragover,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader'][data-drag-active='true'],");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:has(input[type='file']:active),");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:has(input[type='file']:active),");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:has(input[type='file']:active) {");
        sb.AppendLine(indentation + "    border-color: #2563eb !important;");
        sb.AppendLine(indentation + "    background: #dbeafe !important;");
        sb.AppendLine(indentation + "    box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.22), 0 8px 20px rgba(37, 99, 235, 0.18);");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone'] [data-testid='stFileUploaderDropzoneInstructions'] {");
        sb.AppendLine(indentation + "    color: #334155;");
        sb.AppendLine(indentation + "    font-weight: 500;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'],");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'],");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'] {");
        sb.AppendLine(indentation + "    width: 100%;");
        sb.AppendLine(indentation + "    text-align: center;");
        sb.AppendLine(indentation + "    display: flex !important;");
        sb.AppendLine(indentation + "    flex-direction: column;");
        sb.AppendLine(indentation + "    align-items: center;");
        sb.AppendLine(indentation + "    justify-content: center;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) button,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) button,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) button,");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) small,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) small,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) small {");
        sb.AppendLine(indentation + "    display: none !important;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'] > *,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'] > *,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions'] > * {");
        sb.AppendLine(indentation + "    display: none !important;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::before,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::before,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::before {");
        sb.AppendLine(indentation + "    content: ''; ");
        sb.AppendLine(indentation + "    display: block;");
        sb.AppendLine(indentation + "    width: 2.65rem;");
        sb.AppendLine(indentation + "    height: 2.65rem;");
        sb.AppendLine(indentation + "    margin: 0 auto 0.7rem auto;");
        sb.AppendLine(indentation + "    background-repeat: no-repeat;");
        sb.AppendLine(indentation + "    background-position: center;");
        sb.AppendLine(indentation + "    background-size: contain;");
        sb.AppendLine(indentation + "    background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='6' width='14' height='11' rx='2'/%3E%3Cpath d='m6 14 3-3 2 2 2-2 2 3'/%3E%3Ccircle cx='9' cy='10' r='1'/%3E%3Cpath d='M19 7v6'/%3E%3Cpath d='M16 10h6'/%3E%3C/svg%3E\");");
        sb.AppendLine(indentation + "}");
        sb.AppendLine(indentation + "div[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::after,");
        sb.AppendLine(indentation + "section[data-testid='stFileUploaderDropzone']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::after,");
        sb.AppendLine(indentation + "div[data-baseweb='file-uploader']:not(:has([data-testid='stFileUploaderFile'])) [data-testid='stFileUploaderDropzoneInstructions']::after {");
        sb.AppendLine(indentation + "    content: 'Click to upload or drag and drop';");
        sb.AppendLine(indentation + "    display: block;");
        sb.AppendLine(indentation + "    color: #334155;");
        sb.AppendLine(indentation + "    font-size: 1.05rem;");
        sb.AppendLine(indentation + "    font-weight: 500;");
        sb.AppendLine(indentation + "    margin-top: 0.15rem;");
        sb.AppendLine(indentation + "}");
        sb.AppendLine($"{indentation}</style>");
        sb.AppendLine($"{indentation}\"\"\", unsafe_allow_html=True)");
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}{varName} = st.file_uploader(_vdab_disp_lbl_{varName}, key='{uploaderKey}', accept_multiple_files=True, on_change={handlerName})");
        }
        else
        {
            sb.AppendLine($"{indentation}{varName} = st.file_uploader(_vdab_disp_lbl_{varName}, key='{uploaderKey}', accept_multiple_files=True)");
        }
        sb.AppendLine($"{indentation}if '{processedFileKey}' not in st.session_state:");
        sb.AppendLine($"{indentation}    st.session_state['{processedFileKey}'] = []");
        sb.AppendLine($"{indentation}if '{uploadedFilesKey}' not in st.session_state:");
        sb.AppendLine($"{indentation}    st.session_state['{uploadedFilesKey}'] = []");
        sb.AppendLine();

        // Add upload logic if volume path is configured
        if (!string.IsNullOrWhiteSpace(volumePath))
        {
            sb.AppendLine($"{indentation}# Upload to Databricks Volume: {volumePath}");
            sb.AppendLine($"{indentation}if {varName}:");
            sb.AppendLine($"{indentation}    processed_signatures = st.session_state.get('{processedFileKey}', [])");
            sb.AppendLine($"{indentation}    uploaded_count = 0");
            sb.AppendLine($"{indentation}    for uploaded_file in {varName}:");
            sb.AppendLine($"{indentation}        file_signature = f'{{uploaded_file.name}}:{{uploaded_file.size}}'");
            sb.AppendLine($"{indentation}        if file_signature in processed_signatures:");
            sb.AppendLine($"{indentation}            continue");
            sb.AppendLine($"{indentation}        try:");
            sb.AppendLine($"{indentation}            workspace_client = WorkspaceClient(product=PARTNER_NAME, product_version=PARTNER_VERSION)");
            sb.AppendLine($"{indentation}            import io");
            sb.AppendLine($"{indentation}            file_path = f'{volumePath}/{{uploaded_file.name}}'");
            sb.AppendLine($"{indentation}            workspace_client.files.upload(file_path, io.BytesIO(uploaded_file.getvalue()), overwrite=True)");
            sb.AppendLine($"{indentation}            processed_signatures.append(file_signature)");
            sb.AppendLine($"{indentation}            if uploaded_file.name not in st.session_state['{uploadedFilesKey}']:");
            sb.AppendLine($"{indentation}                st.session_state['{uploadedFilesKey}'].append(uploaded_file.name)");
            sb.AppendLine($"{indentation}            uploaded_count += 1");
            sb.AppendLine($"{indentation}        except Exception as e:");
            sb.AppendLine($"{indentation}            st.toast(f'Upload failed: {{str(e)}}', icon=':material/error:')");
            sb.AppendLine($"{indentation}    st.session_state['{processedFileKey}'] = processed_signatures");
            sb.AppendLine($"{indentation}    if uploaded_count > 0:");
            sb.AppendLine($"{indentation}        st.toast(f'Uploaded {{uploaded_count}} file(s) to {volumePath}', icon=':material/check:')");
            sb.AppendLine($"{indentation}else:");
            sb.AppendLine($"{indentation}    st.session_state.pop('{processedFileKey}', None)");
        }
        else
        {
            sb.AppendLine($"{indentation}# No volume configured - file will be held in memory only");
            sb.AppendLine($"{indentation}if {varName}:");
            sb.AppendLine($"{indentation}    processed_signatures = st.session_state.get('{processedFileKey}', [])");
            sb.AppendLine($"{indentation}    uploaded_count = 0");
            sb.AppendLine($"{indentation}    for uploaded_file in {varName}:");
            sb.AppendLine($"{indentation}        file_signature = f'{{uploaded_file.name}}:{{uploaded_file.size}}'");
            sb.AppendLine($"{indentation}        if file_signature in processed_signatures:");
            sb.AppendLine($"{indentation}            continue");
            sb.AppendLine($"{indentation}        processed_signatures.append(file_signature)");
            sb.AppendLine($"{indentation}        if uploaded_file.name not in st.session_state['{uploadedFilesKey}']:");
            sb.AppendLine($"{indentation}            st.session_state['{uploadedFilesKey}'].append(uploaded_file.name)");
            sb.AppendLine($"{indentation}        uploaded_count += 1");
            sb.AppendLine($"{indentation}    st.session_state['{processedFileKey}'] = processed_signatures");
            sb.AppendLine($"{indentation}    if uploaded_count > 0:");
            sb.AppendLine($"{indentation}        st.toast(f'Added {{uploaded_count}} file(s) (in memory)', icon=':material/info:')");
            sb.AppendLine($"{indentation}else:");
            sb.AppendLine($"{indentation}    st.session_state.pop('{processedFileKey}', None)");
        }

        return sb.ToString().TrimEnd();
    }
}
