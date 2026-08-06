// ─── Document Generator: Handlebars → HTML → PDF ────────────
import Handlebars from "handlebars";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Types ──────────────────────────────────────────────────
export interface SplitRow {
  id: number;
  artista: string;
  classe: string;
  pct: string; // "XX,XX%"
}

export interface TemplateData {
  ar: { nome: string };
  artistas_principais: string; // "MC GH, MC Jacaré & Mucilon"
  creditos: string;
  track: { titulo: string; isrc: string; link: string };
  release: { data: string; distribuidora: string; album_id: string };
  splits: {
    obra: SplitRow[];
    fonograma: SplitRow[];
    digital: SplitRow[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────
Handlebars.registerHelper("fmtPct", (bps: number) => {
  return (bps / 100).toFixed(2).replace(".", ",") + "%";
});

// ─── Render ──────────────────────────────────────────────────

/** Get the template path */
function templatePath(): string {
  // Try the packages/docs-gen template
  const candidates = [
    resolve(process.cwd(), "packages/docs-gen/src/templates/autorizacao.hbs"),
    resolve(dirname(fileURLToPath(import.meta.url)), "templates/autorizacao.hbs"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("Template autorizacao.hbs not found");
}

/** Compile the template from file */
let compiled: HandlebarsTemplateDelegate<TemplateData> | null = null;

function getTemplate(): HandlebarsTemplateDelegate<TemplateData> {
  if (!compiled) {
    const src = readFileSync(templatePath(), "utf-8");
    compiled = Handlebars.compile<TemplateData>(src);
  }
  return compiled;
}

/** Render template with data → HTML string */
export function renderHTML(data: TemplateData): string {
  return getTemplate()(data);
}

/** Render template → HTML → PDF buffer */
export async function renderPDF(data: TemplateData): Promise<Buffer> {
  const html = renderHTML(data);

  // Use Playwright headless for PDF (optional dep)
  try {
    // Dynamic import to avoid requiring playwright as hard dep
    const pkg = await Function('return import("playwright")')() as any;
    const browser = await pkg.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "2cm", bottom: "2cm", left: "2cm", right: "2cm" },
      printBackground: true,
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch {
    console.warn("Playwright not available — returning HTML string instead of PDF");
    return Buffer.from(html, "utf-8");
  }
}
