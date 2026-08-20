import type { AuthorizationSection } from "./authorization-document";

type TextOptions = {
  bold?: boolean;
  size?: number;
  x?: number;
  width?: number;
  gapAfter?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 45;
const TOP = 792;
const BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

export function buildAuthorizationTablePdf(sections: AuthorizationSection[]) {
  const pages: string[][] = [[]];
  let y = TOP;

  const page = () => pages[pages.length - 1]!;
  const newPage = () => {
    pages.push([]);
    y = TOP;
  };
  const ensure = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };

  const drawText = (text: string, options: TextOptions = {}) => {
    const size = options.size ?? 10;
    const lineHeight = Math.ceil(size * 1.38);
    const x = options.x ?? MARGIN_X;
    const width = options.width ?? CONTENT_WIDTH;
    const lines = wrapText(text, width, size);
    ensure(lines.length * lineHeight);
    for (const line of lines) {
      page().push(textCommand(line, x, y - size, size, options.bold));
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 8;
  };

  const drawRow = (
    cells: string[],
    widths: number[],
    options: { header?: boolean; boldCells?: number[] } = {},
  ) => {
    const size = 9;
    const paddingX = 6;
    const paddingY = 6;
    const wrapped = cells.map((cell, index) => wrapText(cell, widths[index]! - paddingX * 2, size));
    const rowHeight = Math.max(...wrapped.map((lines) => lines.length), 1) * 12 + paddingY * 2;
    ensure(rowHeight);
    let x = MARGIN_X;

    for (let index = 0; index < cells.length; index++) {
      const width = widths[index]!;
      const bottom = y - rowHeight;
      if (options.header) page().push(`0.93 g ${x} ${bottom} ${width} ${rowHeight} re f 0 g`);
      page().push(`0.65 G 0.6 w ${x} ${bottom} ${width} ${rowHeight} re S 0 G`);
      const bold = options.header || options.boldCells?.includes(index);
      wrapped[index]!.forEach((line, lineIndex) => {
        page().push(
          textCommand(line, x + paddingX, y - paddingY - size - lineIndex * 12, size, bold),
        );
      });
      x += width;
    }
    y -= rowHeight;
  };

  for (const section of sections) {
    if (section.kind === "paragraph") {
      drawText(section.text, { gapAfter: 8 });
      continue;
    }

    if (section.kind === "heading") {
      drawText(section.text, { bold: true, size: 15, gapAfter: 12 });
      continue;
    }

    if (section.kind === "kvTable") {
      for (const row of section.rows) drawRow(row, [155, 350], { boldCells: [0] });
      y -= 16;
      continue;
    }

    if (section.kind === "splitTable") {
      ensure(48);
      drawText(section.title, { bold: true, size: 12, gapAfter: 6 });
      const widths = [38, 160, 185, 122];
      const header = ["ID", "Artista", "Classe", "Participação (%)"];
      drawRow(header, widths, { header: true });
      for (const [rowIndex, row] of section.rows.entries()) {
        const estimatedLines = Math.max(
          wrapText(row.artist, widths[1]! - 12, 9).length,
          wrapText(row.role, widths[2]! - 12, 9).length,
        );
        const estimatedHeight = estimatedLines * 12 + 12;
        const keepTotalWithLastRow = rowIndex === section.rows.length - 1 ? 24 : 0;
        if (y - estimatedHeight - keepTotalWithLastRow < BOTTOM) {
          newPage();
          drawText(`${section.title} (continuação)`, { bold: true, size: 12, gapAfter: 6 });
          drawRow(header, widths, { header: true });
        }
        drawRow([String(row.id), row.artist, row.role, row.percent], widths);
      }
      drawRow(["", "", "Total:", "100%"], widths, { boldCells: [2, 3] });
      y -= 16;
      continue;
    }

    for (const item of section.items)
      drawText(`• ${item}`, { x: MARGIN_X + 12, width: CONTENT_WIDTH - 12, gapAfter: 3 });
    y -= 5;
  }

  pages.forEach((commands, index) => {
    commands.push(
      textCommand(`Página ${index + 1} de ${pages.length}`, PAGE_WIDTH - 110, 28, 8, false),
    );
  });

  return assemblePdf(pages);
}

function wrapText(text: string, width: number, size: number) {
  const maxChars = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textCommand(text: string, x: number, y: number, size: number, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm ${toPdfLiteral(text)} Tj ET`;
}

function assemblePdf(pages: string[][]) {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const regular = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const bold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  const pageIds: number[] = [];
  const placeholder = 0;

  for (const commands of pages) {
    const stream = commands.join("\n");
    const content = add(
      `<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`,
    );
    pageIds.push(
      add(
        [
          "<< /Type /Page",
          `/Parent ${placeholder} 0 R`,
          `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
          `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >>`,
          `/Contents ${content} 0 R`,
          ">>",
        ].join("\n"),
      ),
    );
  }

  const pagesId = add(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1]!.replace(
      `/Parent ${placeholder} 0 R`,
      `/Parent ${pagesId} 0 R`,
    );
  }

  const offsets = [0];
  let pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

function toPdfLiteral(text: string) {
  let out = "(";
  for (const char of text) {
    const byte = winAnsiByte(char);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 0x20 || byte > 0x7e) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return `${out})`;
}

function winAnsiByte(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 0x7f) return code;
  const map: Record<string, number> = {
    á: 0xe1,
    à: 0xe0,
    â: 0xe2,
    ã: 0xe3,
    ä: 0xe4,
    Á: 0xc1,
    À: 0xc0,
    Â: 0xc2,
    Ã: 0xc3,
    Ä: 0xc4,
    é: 0xe9,
    è: 0xe8,
    ê: 0xea,
    ë: 0xeb,
    É: 0xc9,
    È: 0xc8,
    Ê: 0xca,
    Ë: 0xcb,
    í: 0xed,
    ì: 0xec,
    î: 0xee,
    ï: 0xef,
    Í: 0xcd,
    Ì: 0xcc,
    Î: 0xce,
    Ï: 0xcf,
    ó: 0xf3,
    ò: 0xf2,
    ô: 0xf4,
    õ: 0xf5,
    ö: 0xf6,
    Ó: 0xd3,
    Ò: 0xd2,
    Ô: 0xd4,
    Õ: 0xd5,
    Ö: 0xd6,
    ú: 0xfa,
    ù: 0xf9,
    û: 0xfb,
    ü: 0xfc,
    Ú: 0xda,
    Ù: 0xd9,
    Û: 0xdb,
    Ü: 0xdc,
    ç: 0xe7,
    Ç: 0xc7,
    ñ: 0xf1,
    Ñ: 0xd1,
    º: 0xba,
    ª: 0xaa,
    "©": 0xa9,
    "·": 0xb7,
    "“": 0x93,
    "”": 0x94,
    "‘": 0x91,
    "’": 0x92,
    "–": 0x96,
    "—": 0x97,
    "•": 0x95,
  };
  return map[char] ?? 0x3f;
}
