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
  const commands = ["BT"];
  let y = options.pageHeight - options.marginTop;

  for (const line of lines) {
    const size = line.size ?? 11;
    const font = line.bold ? "F2" : "F1";
    commands.push(`/${font} ${size} Tf`);
    commands.push(`1 0 0 1 ${options.marginX} ${y} Tm`);
    commands.push(`${toPdfLiteral(line.text)} Tj`);
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

function toPdfLiteral(text: string) {
  const bytes: number[] = [];
  for (const char of text) {
    bytes.push(winAnsiByte(char));
  }
  let out = "(";
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += `\\${String.fromCharCode(byte)}`;
    } else if (byte < 0x20 || byte > 0x7e) {
      out += `\\${byte.toString(8).padStart(3, "0")}`;
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return `${out})`;
}

function winAnsiByte(char: string) {
  const code = char.charCodeAt(0);
  if (code <= 0x7f) return code;
  const map: Record<string, number> = {
    "á": 0xe1, "à": 0xe0, "â": 0xe2, "ã": 0xe3, "ä": 0xe4,
    "Á": 0xc1, "À": 0xc0, "Â": 0xc2, "Ã": 0xc3, "Ä": 0xc4,
    "é": 0xe9, "è": 0xe8, "ê": 0xea, "ë": 0xeb,
    "É": 0xc9, "È": 0xc8, "Ê": 0xca, "Ë": 0xcb,
    "í": 0xed, "ì": 0xec, "î": 0xee, "ï": 0xef,
    "Í": 0xcd, "Ì": 0xcc, "Î": 0xce, "Ï": 0xcf,
    "ó": 0xf3, "ò": 0xf2, "ô": 0xf4, "õ": 0xf5, "ö": 0xf6,
    "Ó": 0xd3, "Ò": 0xd2, "Ô": 0xd4, "Õ": 0xd5, "Ö": 0xd6,
    "ú": 0xfa, "ù": 0xf9, "û": 0xfb, "ü": 0xfc,
    "Ú": 0xda, "Ù": 0xd9, "Û": 0xdb, "Ü": 0xdc,
    "ç": 0xe7, "Ç": 0xc7, "ñ": 0xf1, "Ñ": 0xd1,
    "º": 0xba, "ª": 0xaa, "©": 0xa9, "·": 0xb7,
    "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92,
    "–": 0x96, "—": 0x97, "•": 0x95,
  };
  return map[char] ?? 0x3f;
}
