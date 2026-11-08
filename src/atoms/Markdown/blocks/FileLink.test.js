import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FileLink from "./FileLink";
import { MarkdownScopeProvider, InDocumentProvider } from "../context";
import { _clearResolveCache } from "../../../utils/resolveRef";

// A CHIP THAT CANNOT RESOLVE TELLS THE AGENT THAT WROTE IT — the wiring claim; the hook's rules
// live in blockFailure.test.js, so here it is a spy.
const mockReported = jest.fn();
jest.mock("../blockFailure", () => ({ useBlockFailure: () => mockReported }));
// CRA resets mock implementations before every test (resetMocks: true), so the promise the
// blocks .catch() on is re-armed here rather than at the declaration.
beforeEach(() => mockReported.mockResolvedValue(null));

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

// THE HUB STANDS IN FOR THE DISK. Opening is a lookup now (`/sv-resolve`, 2026-10-06) — the chip
// asks which project really holds the path instead of assuming the document's. These are the only
// answers the endpoint can give: a hit, a refusal with a reason, or silence.
const hubSays = (fn) => {
  global.fetch = jest.fn((url) => {
    const path = decodeURIComponent(String(url).match(/path=([^&]*)/)[1]);
    const hint = decodeURIComponent((String(url).match(/project=([^&]*)/) || [, ""])[1]);
    const r = fn(path, hint);
    if (r === "down") return Promise.reject(new Error("ECONNREFUSED"));
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true, ...r }) });
  });
};

describe("a file chip belongs to the project that really holds it", () => {
  const opened = [];
  const listener = (e) => opened.push(e.detail);
  beforeEach(() => {
    opened.length = 0;
    _clearResolveCache();
    window.addEventListener("sv:openFileInNav", listener);
  });
  afterEach(() => {
    window.removeEventListener("sv:openFileInNav", listener);
    delete global.fetch;
  });

  it("opens the named project's file, not the document's", async () => {
    hubSays((path, hint) => ({ resolved: true, projectCode: hint, path }));
    inScope(
      <FileLink label="Profiles/common/schemas/Groups.js" attrs={{ project: "buAPI" }} />,
      { projectCode: "BUApp", serviceId: "app-1" },
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].projectCode).toBe("buAPI");
    // …and NOT carrying the document's own service across with it: that service belongs to BUApp.
    expect(opened[0].serviceId).toBe(null);
    expect(opened[0].path).toBe("Profiles/common/schemas/Groups.js");
  });

  it("falls back to the document's project when the reference names none", async () => {
    hubSays((path, hint) => ({ resolved: true, projectCode: hint, path }));
    inScope(<FileLink label="cli/index.js" attrs={{}} />, { projectCode: "BUApp", serviceId: "app-1" });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].projectCode).toBe("BUApp");
    expect(opened[0].serviceId).toBe("app-1");
  });

  it("keeps the line range on the way through", async () => {
    hubSays((path) => ({ resolved: true, projectCode: "systemview-test", path }));
    inScope(<FileLink label="api/index.js#L781-L792" attrs={{ project: "systemview-test" }} />, {});
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].lines).toEqual([781, 792]);
    expect(opened[0].path).toBe("api/index.js");
  });

  // HIS CASE, 2026-10-05: an agent wrote a reference and named no project, because agents do not
  // share this app's grammar — *"that link doesn't work. Should I correct them? No. Or should it
  // work?"* It now works: the chip is live, and the hub says where the file lives.
  it("a reference with no project anywhere is NOT dead — the hub resolves it", async () => {
    hubSays(() => ({ resolved: true, projectCode: "systemview-test", path: "src/atoms/CodeView/colorPicker.js" }));
    inScope(<FileLink label="colorPicker.js" attrs={{}} />, {});
    expect(screen.getByRole("button")).toBeTruthy(); // live before anyone clicks it
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].projectCode).toBe("systemview-test");
    expect(opened[0].path).toBe("src/atoms/CodeView/colorPicker.js");
  });

  // The REASON, never the word "dead" — a chip that cannot resolve should say what the hub said, so
  // the answer to an ambiguous reference is a choice rather than a shrug.
  it("shows the hub's refusal when nothing holds the path", async () => {
    hubSays(() => ({ resolved: false, reason: "no project holds that path" }));
    inScope(<FileLink label="nope/missing.js" attrs={{}} />, {});
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("no project holds that path")).toBeTruthy());
    expect(screen.queryByRole("button")).toBe(null);
    expect(opened).toHaveLength(0);
  });

  // A HUB THAT IS DOWN MUST NOT KILL A WORKING REFERENCE. `api/` changes arm only on a hub restart,
  // so "unreachable" is a normal minute in this system, not an exception.
  it("falls back to the known project when the lookup fails", async () => {
    hubSays(() => "down");
    inScope(<FileLink label="cli/index.js" attrs={{}} />, { projectCode: "BUApp" });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].projectCode).toBe("BUApp");
  });

  it("is dead only when nothing was written at all", () => {
    inScope(<FileLink label="" attrs={{}} />, {});
    expect(screen.queryByRole("button")).toBe(null);
    expect(screen.getByText("no path")).toBeTruthy();
  });

  // THE WRITER HEARS BOTH FAILURES — the empty reference at render, and the hub's refusal at the
  // press. The reader already saw them in the chip; the agent that wrote the block could not.
  it("reports an empty reference to the agent that wrote it", () => {
    mockReported.mockClear();
    inScope(<FileLink label="" attrs={{}} />, {});
    expect(mockReported).toHaveBeenCalledWith({ kind: "file", ref: "", reason: "there is no path in this reference" });
  });

  it("reports the hub's refusal, with the hub's reason", async () => {
    mockReported.mockClear();
    hubSays(() => ({ resolved: false, reason: "no project holds that path" }));
    inScope(<FileLink label="nope/missing.js" attrs={{}} />, {});
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(mockReported).toHaveBeenCalledWith({ kind: "file", ref: "nope/missing.js", reason: "no project holds that path" })
    );
  });

  it("reports nothing when the fallback still opens the file — a hub that is down is not a dead reference", async () => {
    mockReported.mockClear();
    hubSays(() => "down");
    inScope(<FileLink label="cli/index.js" attrs={{}} />, { projectCode: "BUApp" });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(mockReported).not.toHaveBeenCalled();
  });
});

// WHERE THE CHIP LANDS DEPENDS ON WHERE IT IS BEING READ — and getting this wrong shipped once.
//
// The beside-the-one-you-are-on rule was applied to EVERY dispatch, so a file chip in the CHAT
// stopped opening anything: it quietly added a tab elsewhere and the click read as dead. His
// correction: *"that only applies to when you're in the document and you're opening up another
// document, or when you're in the document area and you're clicking a link to another one."*
//
// The suite was green through all of it, because nothing asserted the DIFFERENCE between the two
// places the same block renders. That is what these two claims are.
describe("a chip opens beside only when it is inside a document", () => {
  const opened = [];
  const listener = (e) => opened.push(e.detail);
  beforeEach(() => {
    opened.length = 0;
    _clearResolveCache();
    window.addEventListener("sv:openFileInNav", listener);
    hubSays((path, hint) => ({ resolved: true, projectCode: hint || "p", path }));
  });
  afterEach(() => {
    window.removeEventListener("sv:openFileInNav", listener);
    delete global.fetch;
  });

  it("in the chat it just opens the file — no beside", async () => {
    inScope(<FileLink label="api/index.js" attrs={{ project: "p" }} />, { projectCode: "p" });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].beside).toBeFalsy();
  });

  it("inside a document it opens beside the one you are reading", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MarkdownScopeProvider value={{ projectCode: "p" }}>
          <InDocumentProvider>
            <FileLink label="api/index.js" attrs={{ project: "p" }} />
          </InDocumentProvider>
        </MarkdownScopeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(opened[0].beside).toBe(true);
  });
});
