import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CorporaPanel from "./CorporaPanel";

// RFC-078 §2.6 — the corpora panel's half of the treatment line. Two things are worth asserting
// here, and both are the panel's own to get wrong: that a MACHINE-FED corpus renders apart from
// the authored handbooks (keyed off the `registry` flag the record already carries — one fact, no
// second flag invented for the screen), and that the treatment FIELD saves through the exact same
// door every other corpus edit uses — `saveCorpus`, the write path that lands in corpora.json.
//
// THE HARNESS IS THE SHELL'S, so hostAgents is the one thing stubbed — `mock`-prefixed because
// babel-plugin-jest-hoist lifts the factory above every declaration and refuses any other name.
var mockRows = [];
var mockSave = null;
jest.mock("../../utils/hostAgents", () => ({
  hasDocs: () => true,
  docsList: async () => ({ corpora: mockRows }),
  docsPlan: async () => ({ plan: null }),
  docsIndex: async () => ({ result: {} }),
  docsDrop: async () => ({}),
  docsSearch: async () => ({ results: [] }),
  docsPreview: async () => ({ files: [] }),
  pickPath: async () => ({ canceled: true }),
  listDefs: async () => [],
  saveCorpus: (...a) => mockSave(...a),
}));

const HANDBOOK = {
  name: "sv-handbook",
  kind: "permanent",
  root: "/repo/docs",
  glob: "**/*.md",
  agents: "everyone",
  matched: 3,
  files: 3,
  chunks: 7,
  stale: 0,
  lastIndexed: "2026-11-01T12:00:00Z",
};
const REGISTRY = {
  name: "sv-registry",
  kind: "permanent",
  registry: "systemview",
  agents: "everyone",
  matched: 4,
  files: 4,
  chunks: 9,
  stale: 0,
  lastIndexed: "2026-11-01T12:00:00Z",
};

beforeEach(() => {
  mockRows = [];
  mockSave = jest.fn(async () => ({ corpora: [] }));
});

describe("a machine-fed corpus reads apart from the authored handbooks", () => {
  it("renders the registry row distinctly, off the registry flag alone", async () => {
    mockRows = [HANDBOOK, REGISTRY];
    render(<CorporaPanel />);
    await screen.findByText("sv-registry");
    // the registry row says what feeds it, in the derived baseline's own words
    expect(screen.getByText("machine-fed")).toBeInTheDocument();
    expect(screen.getByText(/work history, not doctrine/)).toBeInTheDocument();
    expect(screen.getByText("systemview")).toBeInTheDocument();
    // the authored handbook still reads as a path — exactly one machine-fed marker on the table
    expect(screen.getByText(/\/repo\/docs/)).toBeInTheDocument();
    expect(screen.getAllByText("machine-fed")).toHaveLength(1);
  });

  it("shows his treatment on the row that carries one", async () => {
    mockRows = [{ ...HANDBOOK, treatment: "doctrine — follow it" }];
    render(<CorporaPanel />);
    await screen.findByText("sv-handbook");
    expect(screen.getByText(/doctrine — follow it/)).toBeInTheDocument();
  });
});

describe("the treatment field saves through the same door as every other edit", () => {
  it("sends the typed treatment in the saveCorpus payload", async () => {
    mockRows = [HANDBOOK];
    render(<CorporaPanel />);
    await screen.findByText("sv-handbook");
    fireEvent.click(screen.getByText("edit"));
    const field = screen.getByPlaceholderText(/the vendor's word/);
    fireEvent.change(field, { target: { value: "  quote it, never paraphrase it  " } });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      name: "sv-handbook",
      root: "/repo/docs",
      treatment: "quote it, never paraphrase it",
    });
  });

  it("edits a registry corpus without demanding a root, and never sends the feed a glob", async () => {
    mockRows = [{ ...REGISTRY, treatment: "trust the dates" }];
    render(<CorporaPanel />);
    await screen.findByText("sv-registry");
    fireEvent.click(screen.getByText("edit"));
    // the form says what feeds it instead of offering a folder to break it with
    expect(screen.getByText(/its files are that project's registered documents/)).toBeInTheDocument();
    expect(screen.queryByText("Choose a folder…")).toBeNull();
    // and the derived baseline is said beside the field his statement prints on top of
    expect(screen.getByText(/prints on top of that line/)).toBeInTheDocument();
    const field = screen.getByPlaceholderText(/the vendor's word/);
    expect(field.value).toBe("trust the dates");
    fireEvent.change(field, { target: { value: "trust the dates, not the prose" } });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const sent = mockSave.mock.calls[0][0];
    expect(sent).toMatchObject({ name: "sv-registry", treatment: "trust the dates, not the prose" });
    expect(sent.root).toBeUndefined();
    expect(sent.glob).toBeUndefined();
  });

  it("an emptied field is sent as an empty string — how a statement is taken back", async () => {
    mockRows = [{ ...HANDBOOK, treatment: "doctrine — follow it" }];
    render(<CorporaPanel />);
    await screen.findByText("sv-handbook");
    fireEvent.click(screen.getByText("edit"));
    const field = screen.getByPlaceholderText(/the vendor's word/);
    expect(field.value).toBe("doctrine — follow it");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0].treatment).toBe("");
  });
});
