import { visit } from "unist-util-visit";

// RFC-025 — the ONE parsing hook that makes markdown interactive everywhere.
//
// `remark-directive` parses three shapes into mdast nodes; this plugin funnels all three into a
// single hast element (`svblock`) carrying the directive's name/type/attributes as props. The
// Markdown atom maps that one element to `SvBlock`, which dispatches through the registry — so a
// new block type is a registry entry, never a change here.
//
//   inline    :ns[Math.add]                    → textDirective
//   leaf      ::chart{report=throughput}       → leafDirective
//   container :::callout{type=warn} … :::      → containerDirective
//
// Raw HTML stays disabled (no rehype-raw) — directives are the ONLY extension point, so a document
// off disk (or written by an agent) can never reach anything we didn't deliberately register.
const TYPES = {
  textDirective: "inline",
  leafDirective: "leaf",
  containerDirective: "container",
};

// The bracketed label (`:ns[Math.add]`) flattened to a plain string. Blocks want the raw text —
// a namespace, a file path — not React children.
function labelOf(node) {
  let out = "";
  visit(node, "text", (t) => {
    out += t.value;
  });
  return out;
}

// The text between a container directive's opening and closing fence, verbatim.
function innerSource(source, node) {
  const p = node.position || {};
  if (!source || !p.start || p.start.offset == null || !p.end || p.end.offset == null) return "";
  const whole = source.slice(p.start.offset, p.end.offset);
  const lines = whole.split("\n");
  if (lines.length <= 2) return "";
  return lines.slice(1, lines[lines.length - 1].trim().startsWith(":::") ? -1 : undefined).join("\n");
}

export default function remarkSvBlocks() {
  // `file` carries the original markdown — a CONTAINER block that authors steps on the fly (`:::run`)
  // needs its RAW body, not rendered children, so it can be parsed as instructions.
  return (tree, file) => {
    const source = String((file && file.value) || "");
    visit(tree, (node) => {
      const dtype = TYPES[node.type];
      if (!dtype) return;
      const data = node.data || (node.data = {});
      data.hName = "svblock";
      data.hProperties = {
        dname: node.name || "",
        dtype,
        // hast property values must be primitives — the attribute bag rides as JSON and is parsed
        // back inside SvBlock.
        dattrs: JSON.stringify(node.attributes || {}),
        // A container's children ARE its content, so it has no label of its own.
        dlabel: dtype === "container" ? "" : labelOf(node),
        // The source line this directive sits on — how an INPUT block (::question, ::slider) writes
        // its answer back into the document it came from (RFC-025 §4.6).
        dline: (node.position && node.position.start && node.position.start.line) || 0,
        // …and the line it ENDS on, so the document menu can act on the whole block (remove a thread
        // wrapper, insert after an embed) rather than only on its first line.
        dend: (node.position && node.position.end && node.position.end.line) || 0,
        // Raw inner source of a container, minus its own `:::` fence lines.
        dsrc: dtype === "container" ? innerSource(source, node) : "",
      };
    });
  };
}
