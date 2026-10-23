import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ProjectJsonObject } from "../models/ProjectComponents";
import NetworkWebStoryVisualPropertiesEditor from "./NetworkWebStoryVisualPropertiesEditor";

describe("NetworkWebStoryVisualPropertiesEditor", () => {
  it("keeps a numeric draft stable while project properties update", async () => {
    const user = userEvent.setup();
    render(<NetworkWebStoryEditorHarness />);

    const maximumNodes = screen.getByRole("spinbutton", {
      name: "Maximum nodes",
    });
    await user.clear(maximumNodes);
    await user.type(maximumNodes, "120");

    expect(maximumNodes).toHaveValue(120);
  });
});

function NetworkWebStoryEditorHarness() {
  const [properties, setProperties] = useState<ProjectJsonObject>({
    maxNodes: 300,
    maxEdges: 800,
  });

  return (
    <NetworkWebStoryVisualPropertiesEditor
      componentKey="networkWebStory1"
      properties={properties}
      disabled={false}
      onPropertiesChange={setProperties}
    />
  );
}
