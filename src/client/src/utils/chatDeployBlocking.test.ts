import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../models/ProjectComponents";
import type { IWorkspaceAppResource } from "../models/ProjectDeployments";
import { getChatDeployBlockingMessage } from "./chatDeployBlocking";

const genie: IProjectComponent = {
  key: "genie-1",
  type: "GenieChat",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "supportGenie",
  description: null,
  properties: { genieSpaceAppResourceName: "" },
  bindings: null,
  children: [],
  layout: null,
};

const model: IProjectComponent = {
  key: "model-1",
  type: "ModelChat",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "supportModel",
  description: null,
  properties: { servingEndpointAppResourceName: "" },
  bindings: null,
  children: [],
  layout: null,
};

const genieResource: IWorkspaceAppResource = {
  name: "sales-genie",
  description: "Sales",
  genie_space: {
    name: "Sales",
    space_id: "0123456789abcdef0123456789abcdef",
    permission: "CAN_RUN",
  },
};

const servingResource: IWorkspaceAppResource = {
  name: "chat-endpoint",
  description: "Chat",
  serving_endpoint: { name: "support-chat", permission: "CAN_QUERY" },
};

describe("getChatDeployBlockingMessage", () => {
  it("blocks an unbound Genie Chat and allows a matching resource", () => {
    expect(getChatDeployBlockingMessage([genie], [])).toMatch(
      /Genie Chat "supportGenie"/,
    );
    expect(
      getChatDeployBlockingMessage(
        [
          {
            ...genie,
            properties: { genieSpaceAppResourceName: "sales-genie" },
          },
        ],
        [genieResource],
      ),
    ).toBeNull();
  });

  it("blocks Model Chat without CAN_QUERY", () => {
    expect(
      getChatDeployBlockingMessage(
        [
          {
            ...model,
            properties: { servingEndpointAppResourceName: "chat-endpoint" },
          },
        ],
        [
          {
            ...servingResource,
            serving_endpoint: { name: "support-chat", permission: "CAN_VIEW" },
          },
        ],
      ),
    ).toMatch(/CAN_VIEW/);
    expect(
      getChatDeployBlockingMessage(
        [
          {
            ...model,
            properties: { servingEndpointAppResourceName: "chat-endpoint" },
          },
        ],
        [servingResource],
      ),
    ).toBeNull();
  });
});
