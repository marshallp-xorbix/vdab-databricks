import assert from "node:assert/strict";
import { readPreviewAppSource, readPreviewModuleSource } from "./smoke-app-response-readers.ts";

/** Checks that the assembled generator preview retains workflow and component contracts. */
export function assertGeneratedPreviewContracts(preview: unknown): void {
  assert.match(readPreviewAppSource(preview), /import custom_modules/);
  assert.match(
    readPreviewAppSource(preview),
    /import prebuilt_modules_library/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /function\(_VdabWorkflowContext\(workflow_state\)\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_run_component_workflows,\s*args=\('smoke-button', 'onClick'\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_run_component_workflows\('smoke-form', 'onSubmit'\)/,
  );
  assert.match(readPreviewAppSource(preview), /action_type == 'triggerToast'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'showModal'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'buildSql'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'runSql'/);
  assert.match(readPreviewAppSource(preview), /action_type == 'setBinding'/);
  assert.match(
    readPreviewAppSource(preview),
    /action_type == 'startDatabricksJob'/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /action_type == 'callCustomModule'/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /action_type == 'callPrebuiltModule'/,
  );
  assert.match(readPreviewAppSource(preview), /action_type == 'saveToTable'/);
  assert.match(
    readPreviewAppSource(preview),
    /SaveToTable supports Unity Catalog or Lakebase Autoscaling targets/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /Generated workflow SQL requires Unity Catalog or Lakebase Autoscaling in the hosting workspace/,
  );
  assert.match(readPreviewAppSource(preview), /api\/2\.2\/jobs\/run-now/);
  assert.match(
    readPreviewAppSource(preview),
    /'Authorization': 'Bearer ' \+ user_token/,
  );
  assert.doesNotMatch(
    readPreviewAppSource(preview),
    /DATABRICKS_CLIENT_SECRET|DATABRICKS_TOKEN/,
  );
  assert.match(readPreviewModuleSource(preview), /def normalize_order\(ctx\):/);
  assert.match(readPreviewAppSource(preview), /st\.text_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.button\(/);
  assert.match(readPreviewAppSource(preview), /'innerRadius': 54/);
  assert.match(readPreviewAppSource(preview), /components\.html\(/);
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __AMOEBA_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __FLOW_FIELD_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __HEAT_MAP_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __HONEYCOMB_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __NETWORK_WEB_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __PULSE_WAVE_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __SPIRAL_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const payload = __TERRAIN_PAYLOAD__/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /components\.iframe\(_vdab_dashboard_src, height=720, scrolling=False\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_render_genie_chat\('vdab_smokegeniechat', '0123456789abcdef0123456789abcdef', True, 600\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_render_model_chat\('vdab_smokemodelchat', 'sample-chat-endpoint'\)/,
  );
  assert.match(readPreviewAppSource(preview), /x-forwarded-access-token/);
  assert.match(readPreviewAppSource(preview), /\/api\/2\.0\/genie\/spaces/);
  assert.doesNotMatch(
    readPreviewAppSource(preview),
    /WorkspaceClient|genie_space_app_resource/,
  );
  assert.match(readPreviewAppSource(preview), /DATABRICKS_WORKSPACE_ID/);
  assert.doesNotMatch(
    readPreviewAppSource(preview),
    /former-workspace\.cloud\.databricks\.com|[?&]o=123456(?:[&'" ]|$)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 100, query_statement=/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /GROUP BY `customer_name`, `customer_name` ORDER BY MAX\(`customer_id`\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /role="group" tabindex="0" aria-label="Spiral journey visualization"/,
  );
  assert.match(readPreviewAppSource(preview), /ArrowRight/);
  assert.match(readPreviewAppSource(preview), /aria-live="polite"/);
  assert.match(
    readPreviewAppSource(preview),
    /SELECT `customer_id` AS time_period, SUM\(`customer_id`\) AS metric_value, AVG\(`customer_id`\) AS baseline_value/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /role="group" tabindex="0" aria-describedby="hint"/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /const result=Object\.create\(null\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /announcer\.textContent=pointDetails\(keyboardIndex\)/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 1000, query_statement=/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /function neighborhood\(rootId, depth\)/,
  );
  assert.match(readPreviewAppSource(preview), /canvas\.addEventListener/);
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/,
  );
  assert.match(readPreviewAppSource(preview), /statusColor\(status\)/);
  assert.match(readPreviewAppSource(preview), /Largest drop-off:/);
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_id`'\)/);
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 100, query_statement=/,
  );
  assert.match(readPreviewAppSource(preview), /GROUP BY `customer_name`'\)/);
  assert.match(readPreviewAppSource(preview), /const RISK_THRESHOLD = 70/);
  assert.match(
    readPreviewAppSource(preview),
    /_vdab_sql_query_df\('main', 'default', 'customers', 500, query_statement=/,
  );
  assert.match(
    readPreviewAppSource(preview),
    /GROUP BY `customer_id` ORDER BY `customer_id`/,
  );
  assert.match(readPreviewAppSource(preview), /Fewer than 8 time points/);
  assert.match(
    readPreviewAppSource(preview),
    /announcer\.textContent=pointDetails\(keyboardIndex\)/,
  );
  assert.match(readPreviewAppSource(preview), /st\.checkbox\(/);
  assert.match(readPreviewAppSource(preview), /st\.toggle\(/);
  assert.match(readPreviewAppSource(preview), /st\.multiselect\(/);
  assert.match(readPreviewAppSource(preview), /st\.date_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.time_input\(/);
  assert.match(readPreviewAppSource(preview), /st\.slider\(/);
  assert.match(readPreviewAppSource(preview), /html\.escape\(str\(/);
  assert.match(
    readPreviewAppSource(preview),
    /with st\.expander\('Workspace details', expanded=True\):/,
  );
  assert.match(readPreviewAppSource(preview), /    st\.markdown\(/);
  assert.match(
    readPreviewAppSource(preview),
    /vdab_smokecolumns = st\.columns\(2\)/,
  );
  assert.match(readPreviewAppSource(preview), /with vdab_smokecolumns\[0\]:/);
  assert.match(
    readPreviewAppSource(preview),
    /vdab_smokerows = st\.container\(\)/,
  );
  assert.match(readPreviewAppSource(preview), /with vdab_smokerows:/);
  assert.match(readPreviewAppSource(preview), /vdab_smoketabs = st\.tabs\(/);
  assert.match(readPreviewAppSource(preview), /default='Details'/);
  assert.match(readPreviewAppSource(preview), /with vdab_smoketabs\[0\]:/);
  assert.match(readPreviewAppSource(preview), /with st\.form\(/);
  assert.match(
    readPreviewAppSource(preview),
    /st\.form_submit_button\('Save smoke form'\)/,
  );
  const generatedAppSource = readPreviewAppSource(preview);
  const generatedFormIndex = generatedAppSource.indexOf("with st.form(");
  assert.ok(
    generatedFormIndex >= 0 &&
      generatedAppSource.indexOf("st.text_input(", generatedFormIndex) <
        generatedAppSource.indexOf("st.checkbox(", generatedFormIndex),
    "Form controls should keep the saved child order.",
  );
  assert.match(
    generatedAppSource,
    /@st\.dialog\('Review smoke', width='medium', position='left', dismissible=False\)/,
  );
  assert.match(generatedAppSource, /def show_smokeModal\(\):/);
  assert.match(
    generatedAppSource,
    /st\.button\('Close', key='vdab_smokemodal_close'\)/,
  );
  assert.match(generatedAppSource, /accept_multiple_files=True/);
  assert.match(generatedAppSource, /_vdab_upload_to_volume\(/);
  assert.match(
    generatedAppSource,
    /Volumes\/main\/default\/uploads\/smoke\/imports/,
  );
  assert.match(generatedAppSource, /SELECT \* FROM \{table_reference\}/);
  assert.match(generatedAppSource, /st\.dataframe\(vdab_smokedatawindow_data/);
  assert.match(generatedAppSource, /st\.data_editor\(/);
  assert.match(
    generatedAppSource,
    /SELECT `customer_id` AS x, `customer_id` AS y/,
  );
  assert.match(generatedAppSource, /'type': 'line', 'point': True/);
  assert.match(
    generatedAppSource,
    /SELECT `customer_name` AS category, SUM\(`customer_id`\) AS value/,
  );
  assert.match(generatedAppSource, /'type': 'arc'/);
  assert.match(generatedAppSource, /_vdab_pie_palette\('#1f77b4'/);
  assert.match(generatedAppSource, /_vdab_sql_validate_primary_key\(/);
  assert.match(generatedAppSource, /COUNT\(DISTINCT/);
  assert.match(generatedAppSource, /_vdab_sql_merge_rows\(/);
  assert.match(generatedAppSource, /from_json\(:changes/);
  assert.match(generatedAppSource, /COUNT\(\*\) AS value/);
  assert.match(generatedAppSource, /st\.vega_lite_chart\(/);
  assert.match(generatedAppSource, /x-forwarded-access-token/);
  assert.doesNotMatch(
    generatedAppSource,
    /workspaceConnectionId|local-smoke-secret/,
  );
  assert.match(
    generatedAppSource,
    /_VDAB_MODEL_CHAT_MAX_RESPONSE_BYTES = 300000/,
  );
  assert.match(generatedAppSource, /x-forwarded-access-token/);
  assert.doesNotMatch(
    generatedAppSource,
    /WorkspaceClient|DATABRICKS_CLIENT_SECRET/,
  );

}
