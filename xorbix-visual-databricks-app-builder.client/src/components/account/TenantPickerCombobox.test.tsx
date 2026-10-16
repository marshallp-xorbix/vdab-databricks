import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tenant } from "../../models";
import TenantPickerCombobox, {
  formatTenantPickerLabel,
} from "./TenantPickerCombobox";

function buildTenant(
  overrides: Partial<ConstructorParameters<typeof Tenant>[0]> = {},
): Tenant {
  return new Tenant({
    tenantId: "11111111-1111-1111-1111-111111111111",
    tenantName: "acme",
    displayName: "Acme Corp",
    isActive: true,
    ...overrides,
  });
}

describe("TenantPickerCombobox", () => {
  it("formatTenantPickerLabel_WithDisplayName_JoinsNameAndId", () => {
    const tenant = buildTenant();

    expect(formatTenantPickerLabel(tenant)).toBe(
      "Acme Corp - 11111111-1111-1111-1111-111111111111",
    );
  });

  it("TenantPickerCombobox_FilterById_ShowsMatchingTenant", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      buildTenant({
        tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        displayName: "Alpha",
      }),
      buildTenant({
        tenantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        displayName: "Beta",
      }),
    ];

    render(
      <TenantPickerCombobox
        options={options}
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByLabelText("Search tenants by display name or ID"),
      "bbbbbbbb",
    );

    expect(screen.getByRole("option", { name: /Beta - bbbbbbbb/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Alpha - aaaaaaaa/i })).not.toBeInTheDocument();
  });

  it("TenantPickerCombobox_FilterByDisplayName_ShowsMatchingTenant", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      buildTenant({
        tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        displayName: "Alpha Works",
      }),
      buildTenant({
        tenantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        displayName: "Beta Labs",
      }),
    ];

    render(
      <TenantPickerCombobox
        options={options}
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByLabelText("Search tenants by display name or ID"),
      "beta",
    );

    expect(
      screen.getByRole("option", { name: /Beta Labs - bbbbbbbb/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Alpha Works - aaaaaaaa/i }),
    ).not.toBeInTheDocument();
  });
});
