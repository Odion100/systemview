import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FileLink from "./FileLink";
import { MarkdownScopeProvider } from "../context";

// A reference into a SIBLING repo is the point of `{project=…}` — BUApp pointing at buAPI from its
// own room. The chip used to resolve its folder by hunting connected services, so it followed the
// document's project no matter what the reference said, and clicking it opened the same path in the
// WRONG repo. The project named on the reference wins, and it travels with the open.
// The scope reads the /specs/… URL when a surface provides none, so the chip needs a router around
// it exactly like the app gives it.
const inScope = (ui, scope) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <MarkdownScopeProvider value={scope}>{ui}</MarkdownScopeProvider>
    </MemoryRouter>,
  );

describe("a file chip belongs to the project it names", () => {
  const opened = [];
  beforeEach(() => {
    opened.length = 0;
    window.addEventListener("sv:openFileInNav", (e) => opened.push(e.detail));
  });

  it("opens the named project's file, not the document's", () => {
    inScope(
      <FileLink label="Profiles/common/schemas/Groups.js" attrs={{ project: "buAPI" }} />,
      { projectCode: "BUApp", serviceId: "app-1" },
    );
    fireEvent.click(screen.getByRole("button"));
    expect(opened).toHaveLength(1);
    expect(opened[0].projectCode).toBe("buAPI");
    // …and NOT carrying the document's own service across with it: that service belongs to BUApp.
    expect(opened[0].serviceId).toBe(null);
    expect(opened[0].path).toBe("Profiles/common/schemas/Groups.js");
  });

  it("falls back to the document's project when the reference names none", () => {
    inScope(<FileLink label="cli/index.js" attrs={{}} />, { projectCode: "BUApp", serviceId: "app-1" });
    fireEvent.click(screen.getByRole("button"));
    expect(opened[0].projectCode).toBe("BUApp");
    expect(opened[0].serviceId).toBe("app-1");
  });

  it("keeps the line range on the way through", () => {
    inScope(<FileLink label="api/index.js#L781-L792" attrs={{ project: "systemview-test" }} />, {});
    fireEvent.click(screen.getByRole("button"));
    expect(opened[0].lines).toEqual([781, 792]);
    expect(opened[0].path).toBe("api/index.js");
  });

  // Services being down is not a reason a reference can't resolve — the folder is the hub's. The one
  // honest dead end left is a reference with no project anywhere: nothing to read it from.
  it("is dead only when no project is in scope and none is named", () => {
    inScope(<FileLink label="cli/index.js" attrs={{}} />, {});
    expect(screen.queryByRole("button")).toBe(null);
    expect(screen.getByText("no project")).toBeTruthy();
  });
});
