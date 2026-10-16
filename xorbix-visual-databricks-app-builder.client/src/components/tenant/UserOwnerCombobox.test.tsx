import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApplicationUser } from "../../models";
import UserOwnerCombobox from "./UserOwnerCombobox";

function createUser(
  overrides: Partial<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>,
): ApplicationUser {
  return new ApplicationUser({
    id: overrides.id ?? "user-1",
    firstName: overrides.firstName ?? "",
    lastName: overrides.lastName ?? "",
    email: overrides.email ?? "",
  });
}

describe("UserOwnerCombobox", () => {
  it("UserOwnerCombobox_FilterByEmail_ShowsMatchingUsers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      createUser({
        id: "jane",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      }),
      createUser({
        id: "john",
        firstName: "John",
        lastName: "Roe",
        email: "john@example.com",
      }),
    ];

    render(
      <UserOwnerCombobox options={options} value="" onChange={onChange} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByLabelText(/search owners by name or email/i),
      "jane@",
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("John Roe")).not.toBeInTheDocument();
  });

  it("UserOwnerCombobox_EmptyOptions_ShowsNoUsersMessage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<UserOwnerCombobox options={[]} value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));

    expect(
      within(screen.getByRole("listbox")).getByText("No users"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No users");
  });

  it("UserOwnerCombobox_NoMatch_ShowsNoMatchingUsersMessage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      createUser({
        id: "jane",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      }),
    ];

    render(
      <UserOwnerCombobox options={options} value="" onChange={onChange} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByLabelText(/search owners by name or email/i),
      "nobody",
    );

    expect(
      within(screen.getByRole("listbox")).getByText("No matching users"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No matching users");
  });

  it("UserOwnerCombobox_AllowNone_SelectsEmptyOwner", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      createUser({
        id: "jane",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      }),
    ];

    render(
      <UserOwnerCombobox
        options={options}
        value="jane"
        onChange={onChange}
        allowNone
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "No owner" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("UserOwnerCombobox_MissingNameAndEmail_ShowsIdAsPrimaryLabel", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [createUser({ id: "orphan-user-id" })];

    render(
      <UserOwnerCombobox options={options} value="" onChange={onChange} />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(
      screen.getByRole("option", { name: "orphan-user-id" }),
    ).toBeInTheDocument();
  });

  it("UserOwnerCombobox_FilterById_ShowsMatchingUser", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      createUser({ id: "orphan-user-id" }),
      createUser({
        id: "jane",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      }),
    ];

    render(
      <UserOwnerCombobox options={options} value="" onChange={onChange} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByLabelText(/search owners by name or email/i),
      "orphan-user",
    );

    expect(
      screen.getByRole("option", { name: "orphan-user-id" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("UserOwnerCombobox_KeyboardEnter_SelectsHighlightedUser", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      createUser({
        id: "jane",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      }),
      createUser({
        id: "john",
        firstName: "John",
        lastName: "Roe",
        email: "john@example.com",
      }),
    ];

    render(
      <UserOwnerCombobox
        options={options}
        value=""
        onChange={onChange}
        allowNone
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const search = screen.getByLabelText(/search owners by name or email/i);
    await user.type(search, "john@");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("john");
    expect(onChange).not.toHaveBeenCalledWith("");
  });
});
