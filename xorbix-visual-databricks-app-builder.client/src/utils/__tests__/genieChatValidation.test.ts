import { describe, expect, it } from "vitest";
import { getGenieChatDeployBlockingMessage } from "../genieChatValidation";
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
    type: ComponentType.GenieChat,
    category: ComponentCategory.Visualization,
    props: {
      genieSpaceAppResourceName: resourceName,
    },
    schemaVersion: 1,
  };
}

describe("getGenieChatDeployBlockingMessage", () => {
  const resources: NormalizedAppResource[] = [
    {
      kind: AppResourceKindSlug.GenieSpace,
      name: "my-genie",
      description: "",
    },
  ];

  it("returns null when all Genie chats are bound to declared resources", () => {
    expect(
      getGenieChatDeployBlockingMessage([chat("1", "g1", "my-genie")], resources),
    ).toBeNull();
  });

  it("returns message when binding is missing", () => {
    const msg = getGenieChatDeployBlockingMessage(
      [chat("1", "g1", "")],
      resources,
    );
    expect(msg).toContain("not bound");
  });

  it("returns message when resource name is unknown", () => {
    const msg = getGenieChatDeployBlockingMessage(
      [chat("1", "g1", "missing")],
      resources,
    );
    expect(msg).toContain("missing");
  });
});
