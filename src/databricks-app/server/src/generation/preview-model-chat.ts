import type { ProjectComponent } from "../db/project-components-contract.ts";
import { readModelChatProperties } from "../db/project-component-model-chat.ts";
import { invalidModelChat } from "./preview-errors.ts";
import { pythonString } from "./preview-python.ts";
import { servingEndpointEnvironmentVariableName } from "./app-resource-env-naming.ts";

/** Appends one ModelChat bound to a serving endpoint App resource env var. */
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
  const endpointEnv = pythonString(
    properties.servingEndpointAppResourceName
      ? servingEndpointEnvironmentVariableName(
          properties.servingEndpointAppResourceName,
        )
      : "",
  );
  const title = pythonString(properties.title);
  const border = properties.showBorder ? "True" : "False";

  lines.push(
    `with st.container(height=${properties.chatTotalHeightPixels}, border=${border}):`,
    `    st.markdown('**' + html.escape(${title}) + '**')`,
    `    if ${endpointEnv} == '':`,
    "        st.info('Bind this Model Chat to a serving endpoint app resource in the builder, then save and regenerate this app.')",
    "    else:",
    `        _vdab_render_model_chat(${pythonString(variableName)}, ${endpointEnv})`,
  );
}
