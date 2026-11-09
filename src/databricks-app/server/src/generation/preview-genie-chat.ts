import type { ProjectComponent } from "../db/project-components-contract.ts";
import { readGenieChatProperties } from "../db/project-component-genie-chat.ts";
import { invalidGenieChat } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import { genieSpaceEnvironmentVariableName } from "./app-resource-env-naming.ts";

/** Appends one Genie chat bound to a Genie space App resource env var. */
export function appendGenieChat(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  if (
    component.type !== "GenieChat" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    component.layout !== null ||
    (component.bindings !== null && Object.keys(component.bindings).length > 0)
  ) {
    throw invalidGenieChat("GenieChat contains an unsupported component shape.");
  }

  const properties = readGenieChatProperties(component.properties, invalidGenieChat);
  const componentKey = pythonString(variableName);
  const title = pythonString(properties.title);
  const resourceName = properties.genieSpaceAppResourceName;
  const envVar = pythonString(
    resourceName ? genieSpaceEnvironmentVariableName(resourceName) : "",
  );
  const border = properties.showBorder ? "True" : "False";
  const height = properties.chatTotalHeightPixels;

  lines.push(
    `st.subheader(${title})`,
    `if ${envVar} == '':`,
    "    st.info('Bind this Genie Chat to a Genie space app resource in the builder, then save and regenerate this app.')",
    "else:",
    `    _vdab_render_genie_chat(${componentKey}, ${envVar}, ${border}, ${height})`,
  );
}
