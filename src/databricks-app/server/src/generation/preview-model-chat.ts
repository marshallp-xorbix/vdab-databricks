import type { ProjectComponent } from "../db/project-components-contract.ts";
import { readModelChatProperties } from "../db/project-component-model-chat.ts";
import { invalidModelChat } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";

/** Appends one viewer-authorized ModelChat preview. */
export function appendModelChat(
  lines: string[],
  component: ProjectComponent,
  variableName: string,
): void {
  if (
    component.type !== "ModelChat" ||
    component.schemaVersion !== 1 ||
    component.children.length > 0 ||
    component.layout !== null ||
    (component.bindings !== null && Object.keys(component.bindings).length > 0)
  ) {
    throw invalidModelChat("ModelChat contains an unsupported component shape.");
  }

  const properties = readModelChatProperties(component.properties, invalidModelChat);
  const endpointName = pythonString(properties.servingEndpointName);
  const title = pythonString(properties.title);
  const border = properties.showBorder ? "True" : "False";

  lines.push(
    `with st.container(height=${properties.chatTotalHeightPixels}, border=${border}):`,
    `    st.markdown('**' + html.escape(${title}) + '**')`,
    `    if ${endpointName} == '':`,
    "        st.info('Select a serving endpoint from this workspace in the builder, then save and regenerate this app.')",
    "    else:",
    `        _vdab_render_model_chat(${pythonString(variableName)}, ${endpointName})`,
  );
}
