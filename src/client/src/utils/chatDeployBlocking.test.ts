import { describe, expect, it } from "vitest";
import type { IProjectComponent } from "../models/ProjectComponents";
import { getChatDeployBlockingMessage } from "./chatDeployBlocking";

const genie: IProjectComponent = {
  key: "genie-1",
  type: "GenieChat",
  schemaVersion: 1,
  componentVersion: 1,
  codeName: "supportGenie",
  description: null,
  properties: { genieSpaceId: "" },
  bindings: null,
  children: [],
  layout: null,
};

describe("getChatDeployBlockingMessage", () => {
  it("blocks an unbound Genie Chat and allows a selected space", () => {
    expect(getChatDeployBlockingMessage([genie])).toMatch(/Genie Chat "supportGenie"/);
    expect(getChatDeployBlockingMessage([{
      ...genie,
      properties: { genieSpaceId: "space-1" },
    }])).toBeNull();
  });
});
