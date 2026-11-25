import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InstalledWorkspaceResourceSelect from "./InstalledWorkspaceResourceSelect";

describe("InstalledWorkspaceResourceSelect", () => {
  it("truncates long selected values in the trigger", () => {
    render(
      <InstalledWorkspaceResourceSelect
        label="Table"
        value="shipment_inspection"
        placeholder="Select a table"
        options={[{ value: "shipment_inspection", label: "shipment_inspection" }]}
        loading={false}
        error={null}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByLabelText("Table");
    expect(trigger.className).toContain("min-w-0");
    expect(trigger.className).toContain("[&>span]:truncate");
  });
});
