import type { ProjectComponent } from "../db/project-components-contract.ts";
import { readDashboardEmbedProperties } from "../db/project-component-dashboard-embed.ts";
import { invalidDashboardEmbed } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";

/** Appends a basic, current-workspace Lakeview dashboard iframe. */
export function appendDashboardEmbed(
  lines: string[],
  component: ProjectComponent,
): void {
  if (
    component.type !== "DashboardEmbed" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    component.layout !== null ||
    (component.bindings !== null && Object.keys(component.bindings).length > 0)
  ) {
    throw invalidDashboardEmbed("DashboardEmbed contains an unsupported component shape.");
  }

  const properties = readDashboardEmbedProperties(component.properties, invalidDashboardEmbed);
  if (properties.src === "") {
    appendDashboardInstructions(lines, "st.info");
    return;
  }

  const parsedReference = new URL(properties.src, "https://vdab.invalid");
  const widgetId = parsedReference.searchParams.get("fullscreenWidget");
  lines.push(
    `_vdab_dashboard_workspace_host = os.environ.get('DATABRICKS_HOST', '')`,
    `_vdab_dashboard_workspace = urllib.parse.urlsplit(_vdab_dashboard_workspace_host)`,
    `_vdab_dashboard_workspace_id = os.environ.get('DATABRICKS_WORKSPACE_ID', '')`,
    `if (_vdab_dashboard_workspace.scheme != 'https' or not _vdab_dashboard_workspace.hostname or _vdab_dashboard_workspace.username or _vdab_dashboard_workspace.password or _vdab_dashboard_workspace.path not in ('', '/') or _vdab_dashboard_workspace.query or _vdab_dashboard_workspace.fragment or not _vdab_dashboard_workspace_id.isascii() or not _vdab_dashboard_workspace_id.isdigit() or len(_vdab_dashboard_workspace_id) > 32):`,
    `    st.error('Dashboard embedding requires valid Databricks workspace runtime configuration.')`,
    `else:`,
    `    _vdab_dashboard_query = {'o': _vdab_dashboard_workspace_id}`,
  );
  if (widgetId !== null) {
    lines.push(`    _vdab_dashboard_query['fullscreenWidget'] = ${pythonString(widgetId)}`);
  }
  lines.push(
    `    _vdab_dashboard_src = urllib.parse.urlunsplit(('https', _vdab_dashboard_workspace.netloc, ${pythonString(parsedReference.pathname)}, urllib.parse.urlencode(_vdab_dashboard_query), ''))`,
    `    components.iframe(_vdab_dashboard_src, height=${properties.height}, scrolling=${properties.scrolling ? "True" : "False"})`,
  );
  appendDashboardInstructions(lines, "st.caption");
}

function appendDashboardInstructions(lines: string[], render: "st.info" | "st.caption"): void {
  lines.push(
    `${render}('Use a published dashboard embed link. Viewers need dashboard access. For per-viewer data access, publish with individual data permissions; shared data permissions use the publisher credentials. A workspace admin must allow this app domain for dashboard embedding.')`,
  );
}
