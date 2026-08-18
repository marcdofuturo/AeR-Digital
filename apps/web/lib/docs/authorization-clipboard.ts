import {
  buildAuthorizationSections,
  type AuthorizationDocumentData,
  type AuthorizationSection,
} from "./authorization-document";

export type AuthorizationClipboardPayload = {
  html: string;
  text: string;
};

const ROOT_STYLE = [
  "color:#000000",
  "background:transparent",
  "font-family:Arial,Helvetica,sans-serif",
  "font-size:11pt",
  "line-height:1.5",
].join(";");

const TABLE_STYLE = "border-collapse:collapse;width:100%;margin:12px 0 20px";
const CELL_STYLE = "border:1px solid #777;padding:6px 8px;color:#000000;background:transparent;text-align:left";

export function buildAuthorizationClipboardPayload(
  data: AuthorizationDocumentData,
): AuthorizationClipboardPayload {
  const sections = buildAuthorizationSections(data);
  return {
    html: `<div style="${ROOT_STYLE}">${sections.map(sectionHtml).join("")}</div>`,
    text: sections.map(sectionText).filter(Boolean).join("\n\n"),
  };
}

function sectionHtml(section: AuthorizationSection) {
  if (section.kind === "paragraph") {
    return `<p style="margin:0 0 12px;color:#000000;background:transparent">${escapeHtml(section.text)}</p>`;
  }
  if (section.kind === "heading") {
    return `<h2 style="margin:20px 0 12px;color:#000000;background:transparent;font-size:14pt">${escapeHtml(section.text)}</h2>`;
  }
  if (section.kind === "list") {
    return `<ul style="margin:0 0 16px;padding-left:24px;color:#000000;background:transparent">${section.items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("")}</ul>`;
  }
  if (section.kind === "kvTable") {
    return htmlTable(section.rows);
  }
  return [
    `<h3 style="margin:18px 0 10px;color:#000000;background:transparent;font-size:12pt">${escapeHtml(section.title)}</h3>`,
    htmlTable([
      ["ID", "Artista", "Classe", "Participacao (%)"],
      ...section.rows.map((row) => [String(row.id), row.artist, row.role, row.percent]),
      ["", "", "Total:", "100%"],
    ]),
  ].join("");
}

function sectionText(section: AuthorizationSection) {
  if (section.kind === "paragraph" || section.kind === "heading") return section.text;
  if (section.kind === "list") return section.items.map((item) => `- ${item}`).join("\n");
  if (section.kind === "kvTable") return section.rows.map((row) => row.join("\t")).join("\n");
  return [
    section.title,
    "ID\tArtista\tClasse\tParticipacao (%)",
    ...section.rows.map((row) => [row.id, row.artist, row.role, row.percent].join("\t")),
    "\t\tTotal:\t100%",
  ].join("\n");
}

function htmlTable(rows: string[][]) {
  return `<table style="${TABLE_STYLE}"><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td style="${CELL_STYLE}">${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
