import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";

// RFC-018 — explicit language map (keyed by fileProviders.languageOf output) shared by CodeView and
// DiffView. A hand-picked set instead of the ~140-language mega bundle keeps the shipped build/ lean;
// a SystemLynx project is JS-first. Unknown language → plain text (null).
const LANGS = {
  javascript: () => javascript({ jsx: true }),
  typescript: () => javascript({ jsx: true, typescript: true }),
  json: () => json(),
  markdown: () => markdown(),
  css: () => css(),
  sass: () => css(),
  less: () => css(),
  html: () => html(),
  xml: () => xml(),
  python: () => python(),
  sql: () => sql(),
  yaml: () => yaml(),
};

export const langExt = (language) => (LANGS[language] ? LANGS[language]() : null);
