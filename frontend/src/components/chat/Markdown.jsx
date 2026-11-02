import { Fragment, memo } from "react";
import { Link } from "react-router-dom";

/**
 * Minimal, XSS-safe markdown for chat replies.
 * Builds React elements only (no innerHTML), so model output can never inject
 * markup or scripts. Supports: paragraphs, **bold**, *italic*, `code`,
 * ``` blocks, - / 1. lists, ### headings, [links](https://... or /internal),
 * and GFM tables. Hidden product tags {{p:123}} are stripped.
 */
const TAG = /[ \t]*\{\{\s*p\s*:\s*\d+\s*\}\}/g;
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function safeHref(href) {
  if (href.startsWith("/") && !href.startsWith("//")) return { internal: true, href };
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" ? { internal: false, href: u.href } : null;
  } catch {
    return null;
  }
}

function inline(text, keyBase) {
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) || [];
      const link = href && safeHref(href);
      if (!link) out.push(label || tok);
      else if (link.internal) out.push(<Link key={key} to={link.href}>{label}</Link>);
      else out.push(<a key={key} href={link.href} target="_blank" rel="noopener noreferrer nofollow">{label}</a>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function Markdown({ text }) {
  const lines = (text || "").replace(TAG, "").replace(/[ \t]+$/gm, "").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `b${blocks.length}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={k}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k} className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead><tr>{head.map((h, j) => <th key={j} scope="col" className="text-left bg-primary-50 px-2 py-1.5 border border-gray-200">{inline(h, `${k}h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="px-2 py-1.5 border border-gray-200 align-top">{inline(c, `${k}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(<h4 key={k}>{inline(heading[2], k)}</h4>);
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items = [];
      const sameKind = (l) => (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/).test(l);
      while (i < lines.length && sameKind(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={k}>{items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</List>);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)])\s+|^#{1,4}\s|^```/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={k}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${k}-${j}`)}
          </Fragment>
        ))}
      </p>
    );
  }
  return <div className="chat-md text-sm leading-relaxed">{blocks}</div>;
}

export default memo(Markdown);
