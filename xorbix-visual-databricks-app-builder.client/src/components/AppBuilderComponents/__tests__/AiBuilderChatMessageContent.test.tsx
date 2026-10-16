import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AiBuilderChatMessageContent from "../AiBuilderChatMessageContent";

describe("AiBuilderChatMessageContent", () => {
  it("renders bold and list markdown for bot messages", () => {
    render(
      <AiBuilderChatMessageContent
        variant="bot"
        content={"**Summary**\n\n- Added a button\n- Added a chart"}
      />,
    );

    expect(screen.getByText("Summary").tagName).toBe("STRONG");
    expect(screen.getByText("Added a button")).toBeInTheDocument();
    expect(screen.getByText("Added a chart")).toBeInTheDocument();
  });

  it("renders inline code for user messages", () => {
    render(
      <AiBuilderChatMessageContent
        variant="user"
        content="Use `customer_id` in the filter"
      />,
    );

    expect(screen.getByText("customer_id").tagName).toBe("CODE");
  });

  it("returns null for blank content", () => {
    const { container } = render(
      <AiBuilderChatMessageContent variant="bot" content="   " />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders bare fenced code blocks with block styling on pre and child neutralization", () => {
    const { container } = render(
      <AiBuilderChatMessageContent
        variant="bot"
        content={"```\nSELECT * FROM table\n```"}
      />,
    );

    const pre = container.querySelector("pre");
    const code = pre?.querySelector("code");
    expect(pre).toBeInTheDocument();
    expect(code).toBeInTheDocument();
    expect(pre?.className).toMatch(/rounded/);
    expect(pre?.className).toMatch(/\[&>code\]:bg-transparent/);
    expect(pre?.className).toMatch(/\[&>code\]:p-0/);
    expect(code?.className).toMatch(/font-mono/);
  });

  it("renders GFM table headers with scope col", () => {
    render(
      <AiBuilderChatMessageContent
        variant="bot"
        content={"| Name | Value |\n| --- | --- |\n| foo | bar |"}
      />,
    );

    const header = screen.getByRole("columnheader", { name: "Name" });
    expect(header).toHaveAttribute("scope", "col");
  });
});
