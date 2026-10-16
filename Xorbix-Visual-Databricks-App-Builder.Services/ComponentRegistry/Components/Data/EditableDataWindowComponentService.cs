using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Data;

/// <summary>
/// Service for EditableDataWindow component
/// </summary>
public class EditableDataWindowComponentService : BaseComponentService, IEditableDataWindowComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.EditableDataWindow;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new EditableDataWindowComponentDto
        {
            Id = "template-editable-datawindow",
            CodeName = "templateEditableDataWindow",
            Type = ComponentType.EditableDataWindow,
            Category = ComponentCategory.Data,
            Icon = "Table",
            SchemaVersion = 1,
            Props = new EditableDataWindowProps
            {
                Label = "Editable Data Table",
                MaxRows = 0,
                Scrollable = true,
                Placeholder = null,
                Disabled = false,
                NumRows = "fixed",
                HideIndex = null,
                Width = "stretch",
                Height = "auto"
            },
            SupportedBindings = new List<string> { "unityCatalogTable", "lakebaseProvisionedDatabase", "lakebaseAutoscaling" },
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
        EditableDataWindowComponentDto editableDataWindow = (EditableDataWindowComponentDto)component;

        string varName = GetVariableName(component);
        string label = editableDataWindow.Props.Label ?? "Editable Data Table";
        string codeName = component.CodeName?.Trim() ?? varName;
        int maxRows = editableDataWindow.Props.MaxRows;
        string? placeholder = editableDataWindow.Props.Placeholder;
        bool disabled = editableDataWindow.Props.Disabled;
        string numRows = editableDataWindow.Props.NumRows;
        bool? hideIndex = editableDataWindow.Props.HideIndex;
        string width = editableDataWindow.Props.Width;
        string height = editableDataWindow.Props.Height;
        string dataIndentation = indentation;
        string? bindingType = null;
        if (component.Bindings != null && component.Bindings.ContainsKey("lakebaseAutoscaling"))
        {
            bindingType = "lakebaseAutoscaling";
        }
        else if (component.Bindings != null && component.Bindings.ContainsKey("lakebaseProvisionedDatabase"))
        {
            bindingType = "lakebaseProvisionedDatabase";
        }
        else if (component.Bindings != null && component.Bindings.ContainsKey("unityCatalogTable"))
        {
            bindingType = "unityCatalogTable";
        }

        if (!string.IsNullOrWhiteSpace(component.CodeName) && !string.IsNullOrWhiteSpace(bindingType))
        {
            sb.AppendLine($"{indentation}{varName}_binding_override = binding_overrides.get('{component.CodeName}:{bindingType}')");
            sb.AppendLine($"{indentation}if {varName}_binding_override is not None:");
            sb.AppendLine($"{indentation}    {varName}_original = _binding_override_to_dataframe({varName}_binding_override)");
            sb.AppendLine($"{indentation}else:");
            dataIndentation += "    ";
        }

        // Extract table info from bindings
        string? catalog = null;
        string? schema = null;
        string? table = null;

        bool usesLakebase = false;
        string? lakebaseDatabase = null;
        string? primaryKeyColumn = null;
        if (component.Bindings != null && component.Bindings.TryGetValue("lakebaseAutoscaling", out var autoscalingBinding))
        {
            if (autoscalingBinding.Source?.Resource != null)
            {
                catalog = autoscalingBinding.Source.Resource.Catalog;
                schema = autoscalingBinding.Source.Resource.Schema;
                table = autoscalingBinding.Source.Resource.Table;
                lakebaseDatabase = autoscalingBinding.Source.Resource.Database;
                primaryKeyColumn = autoscalingBinding.Source.Resource.PrimaryKeyColumn;
                usesLakebase = true;
            }
        }
        else if (component.Bindings != null && component.Bindings.TryGetValue("lakebaseProvisionedDatabase", out var lakebaseBinding))
        {
            if (lakebaseBinding.Source?.Resource != null)
            {
                catalog = lakebaseBinding.Source.Resource.Catalog;
                schema = lakebaseBinding.Source.Resource.Schema;
                table = lakebaseBinding.Source.Resource.Table;
                lakebaseDatabase = lakebaseBinding.Source.Resource.Database;
                primaryKeyColumn = lakebaseBinding.Source.Resource.PrimaryKeyColumn;
                usesLakebase = true;
            }
        }
        else if (component.Bindings != null && component.Bindings.TryGetValue("unityCatalogTable", out var binding))
        {
            if (binding.Source?.Resource != null)
            {
                catalog = binding.Source.Resource.Catalog;
                schema = binding.Source.Resource.Schema;
                table = binding.Source.Resource.Table;
                primaryKeyColumn = binding.Source.Resource.PrimaryKeyColumn;
            }
        }

        // Construct the table reference if all parts are provided.
        // Lakebase/Postgres queries run against the selected database connection already,
        // so they should reference schema.table instead of catalog.schema.table.
        if (!string.IsNullOrWhiteSpace(catalog) && !string.IsNullOrWhiteSpace(schema) && !string.IsNullOrWhiteSpace(table))
        {
            if (usesLakebase)
            {
                catalog = string.IsNullOrWhiteSpace(lakebaseDatabase) ? "databricks_postgres" : lakebaseDatabase;
            }

            var tableReference = usesLakebase
                ? $"{schema}.{table}"
                : $"{catalog}.{schema}.{table}";
            string selectQuery = maxRows > 0
                ? $"SELECT * FROM {tableReference} LIMIT {maxRows}"
                : $"SELECT * FROM {tableReference}";
            if (usesLakebase)
            {
                sb.AppendLine($"{dataIndentation}# Fetch data from Lakebase table: {tableReference}");
                sb.AppendLine($"{dataIndentation}{varName}_original = lakebase_query_df('{selectQuery}')");
            }
            else
            {
                sb.AppendLine($"{dataIndentation}# Fetch data from Unity Catalog table: {tableReference}");
                sb.AppendLine($"{dataIndentation}{varName}_original = sql_query_df('{selectQuery}')");
            }
        }
        else
        {
            sb.AppendLine($"{dataIndentation}# No complete table reference specified (catalog, schema, or table missing), using placeholder data");
            AppendPlaceholderData(sb, varName, dataIndentation);
            sb.AppendLine($"{dataIndentation}{varName}_original = {varName}_data.copy()");
        }

        string? handlerName = GenerationService?.GetTriggerHandlerName(component, "onChange");

        sb.AppendLine($"{indentation}");
        StreamlitUiOverrideSnippets.AppendResolvedLabelVariables(sb, indentation, varName, codeName, label);
        sb.AppendLine($"{indentation}st.subheader(_vdab_disp_lbl_{varName})");
        sb.AppendLine($"{indentation}{varName}_save_status_key = '{varName}_save_status'");
        sb.AppendLine($"{indentation}{varName}_save_status = st.session_state.pop({varName}_save_status_key, None)");
        sb.AppendLine($"{indentation}if {varName}_save_status:");
        sb.AppendLine($"{indentation}    if {varName}_save_status.get('type') == 'success':");
        sb.AppendLine($"{indentation}        st.toast({varName}_save_status.get('message', 'Changes saved successfully!'), icon=':material/check_circle:')");
        sb.AppendLine($"{indentation}    else:");
        sb.AppendLine($"{indentation}        st.toast({varName}_save_status.get('message', 'Error saving changes.'), icon=':material/error:')");
        sb.AppendLine($"{indentation}# Display editable data grid");
        sb.AppendLine($"{indentation}{varName}_edited = st.data_editor(");
        sb.AppendLine($"{indentation}    {varName}_original,");
        sb.AppendLine($"{indentation}    num_rows='{EscapePythonString(numRows)}',");
        sb.AppendLine($"{indentation}    hide_index={ToPythonNullableBool(hideIndex)},");
        sb.AppendLine($"{indentation}    disabled={ToPythonBool(disabled)},");
        sb.AppendLine($"{indentation}    height='{EscapePythonString(height)}',");
        sb.AppendLine($"{indentation}    placeholder={ToPythonNullableStringLiteral(placeholder)},");
        sb.AppendLine($"{indentation}    key='{varName}',");
        if (!string.IsNullOrWhiteSpace(handlerName))
        {
            sb.AppendLine($"{indentation}    on_change={handlerName},");
        }
        sb.AppendLine($"{indentation}    width='{EscapePythonString(width)}'");
        sb.AppendLine($"{indentation})");
        sb.AppendLine($"{indentation}");

        // Only add save functionality if table reference is provided
        if (!string.IsNullOrWhiteSpace(catalog) && !string.IsNullOrWhiteSpace(schema) && !string.IsNullOrWhiteSpace(table))
        {
            if (usesLakebase)
            {
                catalog = string.IsNullOrWhiteSpace(lakebaseDatabase) ? "databricks_postgres" : lakebaseDatabase;
            }

            var tableReference = usesLakebase
                ? $"{schema}.{table}"
                : $"{catalog}.{schema}.{table}";

            sb.AppendLine($"{indentation}{varName}_pk_column = {ToPythonNullableStringLiteral(primaryKeyColumn)}");
            sb.AppendLine($"{indentation}");
            sb.AppendLine($"{indentation}if not {varName}_pk_column:");
            sb.AppendLine($"{indentation}    st.error('A primary key column is required for editable saves.')");
            sb.AppendLine($"{indentation}else:");
            sb.AppendLine($"{indentation}    {varName}_columns = list({varName}_edited.columns)");
            sb.AppendLine($"{indentation}    if {varName}_pk_column not in {varName}_columns:");
            sb.AppendLine($"{indentation}        st.error(f\"Primary key column '{{{varName}_pk_column}}' was not found in the table columns.\")");
            sb.AppendLine($"{indentation}    else:");
            sb.AppendLine($"{indentation}        {varName}_normalize_value = lambda value: None if pd.isna(value) else value");
            sb.AppendLine($"{indentation}        {varName}_normalize_record = lambda record: {{col: {varName}_normalize_value(value) for col, value in record.items()}}");
            sb.AppendLine($"{indentation}        {varName}_original_records = [{varName}_normalize_record(record) for record in {varName}_original.to_dict(orient='records')]");
            sb.AppendLine($"{indentation}        {varName}_edited_records = [{varName}_normalize_record(record) for record in {varName}_edited.to_dict(orient='records')]");
            sb.AppendLine($"{indentation}        {varName}_original_by_pk = {{}}");
            sb.AppendLine($"{indentation}        {varName}_edited_by_pk = {{}}");
            sb.AppendLine($"{indentation}        {varName}_invalid_pk_message = None");
            sb.AppendLine($"{indentation}        for record in {varName}_original_records:");
            sb.AppendLine($"{indentation}            pk_value = record.get({varName}_pk_column)");
            sb.AppendLine($"{indentation}            if pk_value is None:");
            sb.AppendLine($"{indentation}                {varName}_invalid_pk_message = f\"Original data contains null PK values in column '{{{varName}_pk_column}}'.\"");
            sb.AppendLine($"{indentation}                break");
            sb.AppendLine($"{indentation}            if pk_value in {varName}_original_by_pk:");
            sb.AppendLine($"{indentation}                {varName}_invalid_pk_message = f\"Original data contains duplicate PK value '{{pk_value}}' in column '{{{varName}_pk_column}}'.\"");
            sb.AppendLine($"{indentation}                break");
            sb.AppendLine($"{indentation}            {varName}_original_by_pk[pk_value] = record");
            sb.AppendLine($"{indentation}        if {varName}_invalid_pk_message is None:");
            sb.AppendLine($"{indentation}            for record in {varName}_edited_records:");
            sb.AppendLine($"{indentation}                pk_value = record.get({varName}_pk_column)");
            sb.AppendLine($"{indentation}                if pk_value is None:");
            sb.AppendLine($"{indentation}                    {varName}_invalid_pk_message = f\"Edited data contains null PK values in column '{{{varName}_pk_column}}'.\"");
            sb.AppendLine($"{indentation}                    break");
            sb.AppendLine($"{indentation}                if pk_value in {varName}_edited_by_pk:");
            sb.AppendLine($"{indentation}                    {varName}_invalid_pk_message = f\"Edited data contains duplicate PK value '{{pk_value}}' in column '{{{varName}_pk_column}}'.\"");
            sb.AppendLine($"{indentation}                    break");
            sb.AppendLine($"{indentation}                {varName}_edited_by_pk[pk_value] = record");
            sb.AppendLine($"{indentation}        if {varName}_invalid_pk_message:");
            sb.AppendLine($"{indentation}            st.error({varName}_invalid_pk_message)");
            sb.AppendLine($"{indentation}        else:");
            sb.AppendLine($"{indentation}            {varName}_deleted_pks = [pk for pk in {varName}_original_by_pk.keys() if pk not in {varName}_edited_by_pk]");
            sb.AppendLine($"{indentation}            {varName}_insert_records = [record for pk, record in {varName}_edited_by_pk.items() if pk not in {varName}_original_by_pk]");
            sb.AppendLine($"{indentation}            {varName}_non_pk_columns = [column for column in {varName}_columns if column != {varName}_pk_column]");
            sb.AppendLine($"{indentation}            {varName}_update_records = []");
            sb.AppendLine($"{indentation}            for pk, edited_record in {varName}_edited_by_pk.items():");
            sb.AppendLine($"{indentation}                original_record = {varName}_original_by_pk.get(pk)");
            sb.AppendLine($"{indentation}                if original_record is None:");
            sb.AppendLine($"{indentation}                    continue");
            sb.AppendLine($"{indentation}                if any(original_record.get(column) != edited_record.get(column) for column in {varName}_non_pk_columns):");
            sb.AppendLine($"{indentation}                    {varName}_update_records.append(edited_record)");
            sb.AppendLine($"{indentation}            {varName}_has_changes = bool({varName}_deleted_pks or {varName}_insert_records or {varName}_update_records)");
            sb.AppendLine($"{indentation}            if not {varName}_has_changes:");
            sb.AppendLine($"{indentation}                st.info('No data changes detected.')");
            sb.AppendLine($"{indentation}            elif len({varName}_columns) == 0:");
            sb.AppendLine($"{indentation}                st.error('No columns found to save.')");
            sb.AppendLine($"{indentation}            elif st.button('Save Changes', key='{varName}_save'):");
            sb.AppendLine($"{indentation}                {varName}_progress = st.empty()");
            sb.AppendLine($"{indentation}                try:");
            sb.AppendLine($"{indentation}                    with {varName}_progress:");
            sb.AppendLine($"{indentation}                        st.info('Calling Databricks SQL...')");
            if (usesLakebase)
            {
                sb.AppendLine($@"{indentation}                    {varName}_pk_quoted = f'""{{{varName}_pk_column}}""'");
                sb.AppendLine($@"{indentation}                    {varName}_column_list = "", "".join([f'""{{c}}""' for c in {varName}_columns])");
                sb.AppendLine($@"{indentation}                    {varName}_insert_params = "", "".join([f':{{c}}' for c in {varName}_columns])");
                sb.AppendLine($@"{indentation}                    {varName}_delete_sql = f'DELETE FROM {tableReference} WHERE {{{varName}_pk_quoted}} = :pk_value'");
                sb.AppendLine($"{indentation}                    {varName}_delete_rows = [{{'pk_value': pk}} for pk in {varName}_deleted_pks]");
                sb.AppendLine($"{indentation}                    {varName}_update_rows = []");
                sb.AppendLine($"{indentation}                    for record in {varName}_update_records:");
                sb.AppendLine($"{indentation}                        row = {{'pk_value': record[{varName}_pk_column]}}");
                sb.AppendLine($"{indentation}                        for column in {varName}_non_pk_columns:");
                sb.AppendLine($"{indentation}                            row[column] = record.get(column)");
                sb.AppendLine($"{indentation}                        {varName}_update_rows.append(row)");
                sb.AppendLine($@"{indentation}                    {varName}_set_clause = "", "".join([f'""{{column}}"" = :{{column}}' for column in {varName}_non_pk_columns])");
                sb.AppendLine($@"{indentation}                    {varName}_update_sql = f'UPDATE {tableReference} SET {{{varName}_set_clause}} WHERE {{{varName}_pk_quoted}} = :pk_value'");
                sb.AppendLine($@"{indentation}                    {varName}_insert_sql = f'INSERT INTO {tableReference} ({{{varName}_column_list}}) VALUES ({{{varName}_insert_params}})'");
                sb.AppendLine($"{indentation}                    engine = get_engine()");
                sb.AppendLine($"{indentation}                    with engine.begin() as conn:");
                sb.AppendLine($"{indentation}                        if {varName}_delete_rows:");
                sb.AppendLine($"{indentation}                            conn.execute(text({varName}_delete_sql), {varName}_delete_rows)");
                sb.AppendLine($"{indentation}                        if {varName}_update_rows and {varName}_non_pk_columns:");
                sb.AppendLine($"{indentation}                            conn.execute(text({varName}_update_sql), {varName}_update_rows)");
                sb.AppendLine($"{indentation}                        if {varName}_insert_records:");
                sb.AppendLine($"{indentation}                            conn.execute(text({varName}_insert_sql), {varName}_insert_records)");
            }
            else
            {
                sb.AppendLine($@"{indentation}                    {varName}_pk_backtick = f'`{{{varName}_pk_column}}`'");
                sb.AppendLine($@"{indentation}                    {varName}_column_list = "", "".join([f'`{{c}}`' for c in {varName}_columns])");
                sb.AppendLine($@"{indentation}                    {varName}_insert_placeholders = "", "".join(['?'] * len({varName}_columns))");
                sb.AppendLine($@"{indentation}                    {varName}_insert_sql = f'INSERT INTO {tableReference} ({{{varName}_column_list}}) VALUES ({{{varName}_insert_placeholders}})'");
                sb.AppendLine($@"{indentation}                    {varName}_insert_params = [tuple(record.get(column) for column in {varName}_columns) for record in {varName}_insert_records]");
                sb.AppendLine($@"{indentation}                    {varName}_delete_sql = f'DELETE FROM {tableReference} WHERE {{{varName}_pk_backtick}} = ?'");
                sb.AppendLine($"{indentation}                    {varName}_delete_params = [(pk,) for pk in {varName}_deleted_pks]");
                sb.AppendLine($@"{indentation}                    {varName}_set_clause = "", "".join([f'`{{column}}` = ?' for column in {varName}_non_pk_columns])");
                sb.AppendLine($@"{indentation}                    {varName}_update_sql = f'UPDATE {tableReference} SET {{{varName}_set_clause}} WHERE {{{varName}_pk_backtick}} = ?'");
                sb.AppendLine($"{indentation}                    {varName}_update_params = [tuple(record.get(column) for column in {varName}_non_pk_columns) + (record[{varName}_pk_column],) for record in {varName}_update_records]");
                sb.AppendLine($"{indentation}                    if {varName}_delete_params:");
                sb.AppendLine($"{indentation}                        sql_execute({varName}_delete_sql, {varName}_delete_params)");
                sb.AppendLine($"{indentation}                    if {varName}_update_params and {varName}_non_pk_columns:");
                sb.AppendLine($"{indentation}                        sql_execute({varName}_update_sql, {varName}_update_params)");
                sb.AppendLine($"{indentation}                    if {varName}_insert_params:");
                sb.AppendLine($"{indentation}                        sql_execute({varName}_insert_sql, {varName}_insert_params)");
            }
            sb.AppendLine($"{indentation}                    {varName}_progress.empty()");
            sb.AppendLine($"{indentation}                    st.session_state[{varName}_save_status_key] = {{'type': 'success', 'message': f\"Changes saved successfully (updated: {{len({varName}_update_records)}}, inserted: {{len({varName}_insert_records)}}, deleted: {{len({varName}_deleted_pks)}}).\"}}");
            sb.AppendLine($"{indentation}                    st.rerun()");
            sb.AppendLine($"{indentation}                except Exception as e:");
            sb.AppendLine($"{indentation}                    {varName}_progress.empty()");
            sb.AppendLine($"{indentation}                    st.session_state[{varName}_save_status_key] = {{'type': 'error', 'message': f'Error saving changes: {{str(e)}}'}}");
            sb.AppendLine($"{indentation}                    st.rerun()");
        }

        return sb.ToString().TrimEnd();
    }

    private static string EscapePythonString(string value) => value.Replace("\\", "\\\\").Replace("'", "\\'");

    private static string ToPythonNullableBool(bool? value)
    {
        if (!value.HasValue)
        {
            return "None";
        }

        return value.Value ? "True" : "False";
    }

    private static string ToPythonNullableStringLiteral(string? value)
    {
        if (value is null)
        {
            return "None";
        }

        return $"'{EscapePythonString(value)}'";
    }
}
