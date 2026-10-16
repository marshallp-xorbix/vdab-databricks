import { describe, expect, it } from "vitest";
import { getModelChatDeployBlockingMessage } from "../modelChatValidation";
import {
  ComponentCategory,
  ComponentType,
} from "../../types/components/componentTypes";
import { AppResourceKindSlug } from "../../types/appResourceKinds";
import type { VdabComponent } from "../../types/components";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";

function chat(
  id: string,
  codeName: string,
  resourceName: string,
): VdabComponent {
  return {
    id,
    codeName,
    type: ComponentType.ModelChat,
    category: ComponentCategory.Visualization,
    props: {
      servingEndpointAppResourceName: resourceName,
    },
    schemaVersion: 1,
  };
}

function servingEndpoint(
  name: string,
  permission: string,
): NormalizedAppResource {
  return {
    kind: AppResourceKindSlug.ServingEndpoint,
    name,
    description: "",
    servingEndpoint: {
      name,
      permission,
    },
  };
}

describe("getModelChatDeployBlockingMessage", () => {
  const resources: NormalizedAppResource[] = [
    servingEndpoint("my-endpoint", "CAN_QUERY"),
  ];

  it("returns null when all Model chats are bound to queryable resources", () => {
    expect(
      getModelChatDeployBlockingMessage(
        [chat("1", "modelChat1", "my-endpoint")],
        resources,
      ),
    ).toBeNull();
  });

  it("returns message when binding is missing", () => {
    const msg = getModelChatDeployBlockingMessage(
      [chat("1", "modelChat1", "")],
      resources,
    );
    expect(msg).toContain("not bound");
  });

  it("returns message when resource name is unknown", () => {
    const msg = getModelChatDeployBlockingMessage(
      [chat("1", "modelChat1", "missing")],
      resources,
    );
    expect(msg).toContain("no serving_endpoint resource with that name exists");
  });

  it("returns message when resource permission cannot query", () => {
    const msg = getModelChatDeployBlockingMessage(
      [chat("1", "modelChat1", "view-only")],
      [servingEndpoint("view-only", "CAN_VIEW")],
    );
    expect(msg).toContain("CAN_QUERY or CAN_MANAGE");
  });
});
