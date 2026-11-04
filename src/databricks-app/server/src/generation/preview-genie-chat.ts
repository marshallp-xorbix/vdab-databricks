import type { ProjectComponent } from "../db/project-components-contract.ts";
import { readGenieChatProperties } from "../db/project-component-genie-chat.ts";
import { invalidGenieChat } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";

/** Appends one standalone Genie chat bound to a current-workspace space ID. */
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
  const spaceId = pythonString(properties.genieSpaceId);
  const border = properties.showBorder ? "True" : "False";
  const height = properties.chatTotalHeightPixels;

  lines.push(
    `st.subheader(${title})`,
    `if ${spaceId} == '':`,
    "    st.info('Select a Genie space from the current workspace in the builder, then save and regenerate this app.')",
    "else:",
    `    _vdab_render_genie_chat(${componentKey}, ${spaceId}, ${border}, ${height})`,
  );
}
