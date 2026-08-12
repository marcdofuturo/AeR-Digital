type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
};

export function buildSimplePdf(lines: PdfLine[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 56;
  const marginTop = 72;
  const lineGap = 17;
  const maxChars = 82;

  const pages: PdfLine[][] = [[]];
  let cursorY = marginTop;

  for (const line of lines.flatMap((line) => wrapLine(line, maxChars))) {
    if (cursorY > pageHeight - 72) {
      pages.push([]);
      cursorY = marginTop;
    }
    pages[pages.length - 1]!.push(line);
    cursorY += line.size && line.size > 14 ? 22 : lineGap;
  }

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  const pagesIdPlaceholder = 0;

  for (const pageLines of pages) {
    const stream = pageContentStream(pageLines, {
      pageHeight,
      marginX,
      marginTop,
      lineGap,
    });
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    const pageId = add([
      "<< /Type /Page",
      `/Parent ${pagesIdPlaceholder} 0 R`,
      `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
      ` /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`,
      `/Contents ${contentId} 0 R`,
      ">>",
    ].join("\n"));
    pageIds.push(pageId);
  }

  const pagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1]!.replace(`/Parent ${pagesIdPlaceholder} 0 R`, `/Parent ${pagesId} 0 R`);
  }

  const offsets: number[] = [0];
  let pdf = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}

function pageContentStream(
  lines: PdfLine[],
  options: { pageHeight: number; marginX: number; marginTop: number; lineGap: number },
) {
  const commands = ["BT", "1 0 0 1 0 0 Tm"];
  let y = options.pageHeight - options.marginTop;

  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "F2" : "F1";
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${options.marginX} ${y} Td`);
    commands.push(`${toPdfUtf16Hex(line.text)} Tj`);
    commands.push(`${-options.marginX} ${-options.lineGap} Td`);
    y -= line.size && line.size > 14 ? 22 : options.lineGap;
  }

  commands.push("ET");
  return commands.join("\n");
}

function wrapLine(line: PdfLine, maxChars: number): PdfLine[] {
  if (!line.text.trim()) return [{ ...line, text: "" }];
  const words = line.text.split(/\s+/);
  const out: PdfLine[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      out.push({ ...line, text: current });
      current = word;
    } else {
      current = next;
    }
  }

  if (current) out.push({ ...line, text: current });
  return out;
}

function toPdfUtf16Hex(text: string) {
  const bytes = [0xfe, 0xff];
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}
