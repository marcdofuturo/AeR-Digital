import { buildSimpleDocx, type DocxBlock } from "./simple-docx";
import { buildSimplePdf } from "./simple-pdf";

type SplitLine = {
  scope?: string;
  holder_type: "artist" | "label";
  artist_id?: string | null;
  role_label: string;
  bps100: number;
  version?: number;
};

type Participant = {
  artist_id?: string | null;
  position?: number | null;
  artists?: {
    id?: string;
    stage_name?: string | null;
    legal_name?: string | null;
  } | null;
};

export type AuthorizationDocumentData = {
  representativeName: string;
  labelName: string;
  releaseTitle: string;
  trackTitle: string;
  artists: string;
  releaseDate: string;
  distributor: string;
  isrc: string;
  albumId: string;
  trackLink: string;
  splits: {
    obra: AuthorizationSplitRow[];
    fonograma: AuthorizationSplitRow[];
    digital: AuthorizationSplitRow[];
  };
};

export type AuthorizationSplitRow = {
  id: number;
  artist: string;
  role: string;
  percent: string;
};

export type AuthorizationSection =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "kvTable"; rows: string[][] }
  | { kind: "splitTable"; title: string; rows: AuthorizationSplitRow[] }
  | { kind: "list"; items: string[] };

export function buildAuthorizationDocumentData({
  release,
  track,
  tenant,
}: {
  release: any;
  track: any;
  tenant: any;
}): AuthorizationDocumentData {
  const labelName = cleanHumanText(tenant?.name ?? "Audiolink Brasil");
  const participants = [...(track.track_participants ?? [])]
    .sort((a: Participant, b: Participant) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const artistById = new Map<string, string>();

  for (const participant of participants) {
    const artist = participant.artists ?? {};
    if (participant.artist_id) {
      artistById.set(
        String(participant.artist_id),
        cleanHumanText(artist.legal_name || artist.stage_name || "Participante"),
      );
    }
  }

  const artists = participants
    .map((participant: Participant) => participant.artists?.stage_name || participant.artists?.legal_name)
    .filter((name): name is string => Boolean(name))
    .map((name: string) => cleanHumanText(name))
    .join(", ");

  return {
    representativeName: resolveRepresentativeName(tenant, labelName),
    labelName,
    releaseTitle: cleanHumanText(release.title ?? track.title ?? "Lançamento"),
    trackTitle: cleanHumanText(track.title ?? release.title ?? "Faixa"),
    artists: artists || "Artistas não informados",
    releaseDate: formatDate(release.release_date),
    distributor: cleanHumanText(release.distributor ?? "Audiolink Brasil"),
    isrc: cleanHumanText(track.isrc ?? "a gerar"),
    albumId: cleanHumanText(release.album_id_ext ?? release.upc ?? "a gerar"),
    trackLink: cleanHumanText(track.audio_url ?? ""),
    splits: {
      obra: splitRows(track.splits ?? [], "obra", artistById, labelName),
      fonograma: splitRows(track.splits ?? [], "fonograma", artistById, labelName),
      digital: splitRows(track.splits ?? [], "digital", artistById, labelName),
    },
  };
}

export function buildAuthorizationSections(data: AuthorizationDocumentData): AuthorizationSection[] {
  return [
    { kind: "paragraph", text: "Olá, pessoal!" },
    { kind: "paragraph", text: "Espero que estejam bem." },
    {
      kind: "paragraph",
      text: `Sou o ${data.representativeName} e neste documento represento a empresa e seus artistas ${data.artists}.`,
    },
    {
      kind: "paragraph",
      text: "Venho por meio deste solicitar, de forma oficial, a autorização para o lançamento digital da faixa abaixo;",
    },
    { kind: "paragraph", text: "Todos os detalhes do lançamento seguem especificados a seguir:" },
    { kind: "heading", text: "Autorização de Distribuição Digital" },
    {
      kind: "kvTable",
      rows: [
        ["Nome da Faixa:", data.trackTitle],
        ["Artistas:", data.artists],
        ["Data de Lançamento:", data.releaseDate],
        ["Agregadora:", data.distributor],
        ["ISRC:", data.isrc],
        ["ID do Álbum:", data.albumId],
        ["Link da Faixa:", data.trackLink || "a inserir"],
      ],
    },
    { kind: "splitTable", title: "Obra", rows: data.splits.obra },
    { kind: "splitTable", title: "Fonograma", rows: data.splits.fonograma },
    { kind: "splitTable", title: "Digital", rows: data.splits.digital },
    {
      kind: "paragraph",
      text: "Caso todos estejam de acordo com o lançamento, por gentileza, responder este e-mail com a seguinte mensagem:",
    },
    { kind: "paragraph", text: `"Eu, [NOME] sou responsável pelo [ARTISTA], autorizo este lançamento."` },
    { kind: "paragraph", text: "Solicito também que seja preenchido o nosso formulário de cadastro:" },
    {
      kind: "list",
      items: [
        "CPF",
        "E-mails para repasse de royalties e respectivas porcentagens de empresários e agenciadores",
        "Telefone para contato (WhatsApp)",
      ],
    },
    { kind: "paragraph", text: "Qualquer dúvida, estou à disposição." },
  ];
}

export function buildAuthorizationMarkdown(data: AuthorizationDocumentData) {
  return buildAuthorizationSections(data).map((section) => {
    if (section.kind === "paragraph") return section.text;
    if (section.kind === "heading") return `**${section.text}**`;
    if (section.kind === "kvTable") return tableMarkdown(section.rows);
    if (section.kind === "splitTable") return splitSectionMarkdown(section.title, section.rows);
    return section.items.map((item) => `* ${item}`).join("\n");
  }).join("\n\n");
}

export function buildAuthorizationDocx(data: AuthorizationDocumentData) {
  return buildSimpleDocx(buildDocxBlocks(data));
}

export function buildAuthorizationPdf(data: AuthorizationDocumentData) {
  return buildSimplePdf(buildPdfLines(data));
}

function buildDocxBlocks(data: AuthorizationDocumentData): DocxBlock[] {
  return buildAuthorizationSections(data).flatMap((section): DocxBlock[] => {
    if (section.kind === "paragraph") return [{ kind: "paragraph", text: section.text }];
    if (section.kind === "heading") return [{ kind: "heading", text: section.text, level: 1 }];
    if (section.kind === "kvTable") return [{ kind: "table", rows: section.rows }];
    if (section.kind === "splitTable") return [
      { kind: "heading", text: section.title, level: 2 },
      {
        kind: "table",
        rows: [
          ["ID", "Artista", "Classe", "Participação (%)"],
          ...section.rows.map((row) => [String(row.id), row.artist, row.role, row.percent]),
          ["", "", "Total:", "100%"],
        ],
      },
    ];
    return section.items.map((item) => ({ kind: "paragraph", text: `• ${item}` }));
  });
}

function buildPdfLines(data: AuthorizationDocumentData) {
  const lines: Array<{ text: string; size?: number; bold?: boolean }> = [];
  for (const section of buildAuthorizationSections(data)) {
    if (section.kind === "paragraph") lines.push({ text: section.text }, { text: "" });
    if (section.kind === "heading") lines.push({ text: section.text, size: 15, bold: true }, { text: "" });
    if (section.kind === "kvTable") {
      for (const row of section.rows) {
        const field = row[0] ?? "";
        const value = row[1] ?? "";
        lines.push({ text: `${field.padEnd(21, " ")} ${value}` });
      }
      lines.push({ text: "" });
    }
    if (section.kind === "splitTable") {
      lines.push({ text: section.title, bold: true });
      lines.push({ text: "ID   Artista                         Classe                         Participação (%)", bold: true });
      for (const row of section.rows) {
        lines.push({
          text: [
            String(row.id).padEnd(4, " "),
            row.artist.slice(0, 29).padEnd(31, " "),
            row.role.slice(0, 30).padEnd(32, " "),
            row.percent,
          ].join(""),
        });
      }
      lines.push({ text: "                                      Total:                         100%" });
      lines.push({ text: "" });
    }
    if (section.kind === "list") {
      for (const item of section.items) lines.push({ text: `• ${item}` });
      lines.push({ text: "" });
    }
  }
  return lines;
}

function splitRows(splits: SplitLine[], scope: string, artistById: Map<string, string>, labelName: string) {
  const latest = latestSplits(splits, scope);
  return latest.map((line, index) => ({
    id: index + 1,
    artist: line.holder_type === "label"
      ? labelName
      : artistById.get(String(line.artist_id)) ?? "Participante",
    role: normalizeRole(line.role_label),
    percent: formatPercent(line.bps100),
  }));
}

function latestSplits(splits: SplitLine[], scope: string) {
  const filtered = splits.filter((split) => split.scope === scope) as Array<SplitLine & { scope: string }>;
  if (!filtered.length) return [];
  const maxVersion = Math.max(...filtered.map((split) => Number(split.version ?? 1)));
  return filtered.filter((split) => Number(split.version ?? 1) === maxVersion);
}

function splitSectionMarkdown(title: string, rows: AuthorizationSplitRow[]) {
  return [
    `**${title}**`,
    "",
    "| ID | Artista | Classe | Participação (%) |",
    "| ----- | ----- | ----- | ----- |",
    ...rows.map((row) => `| ${row.id} | ${row.artist} | ${row.role} | ${row.percent} |`),
    "|  |  | **Total:** | 100% |",
  ].join("\n");
}

function tableMarkdown(rows: string[][]) {
  return [
    "| Campo | Valor |",
    "| :---- | :---- |",
    ...rows.map(([key, value]) => `| ${key} | ${value} |`),
  ].join("\n");
}

function resolveRepresentativeName(tenant: any, labelName: string) {
  if (normalizeText(labelName) === "supertime digital") return "LucIA";
  return cleanHumanText(
    tenant?.responsible_name
      || tenant?.representative_name
      || tenant?.legal_representative
      || tenant?.legal_name
      || labelName,
  );
}

function normalizeRole(role: string) {
  const cleanRole = cleanHumanText(role);
  return normalizeText(cleanRole) === "musico" ? "Músico acompanhante" : cleanRole;
}

function normalizeText(value: string) {
  return cleanHumanText(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "a definir";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return cleanHumanText(String(value));
  return `${day}/${month}/${year}`;
}

function formatPercent(bps100: number) {
  return `${(Number(bps100) / 100).toFixed(2).replace(".", ",")}%`;
}

function cleanHumanText(value: string) {
  let text = String(value);
  const replacements: Array<[string, string]> = [
    ["Ã¡", "á"], ["Ã ", "à"], ["Ã¢", "â"], ["Ã£", "ã"],
    ["Ã©", "é"], ["Ãª", "ê"], ["Ã­", "í"], ["Ã³", "ó"],
    ["Ã´", "ô"], ["Ãµ", "õ"], ["Ãº", "ú"], ["Ã§", "ç"],
    ["Ã", "Á"], ["Ã‰", "É"], ["Ã", "Í"], ["Ã“", "Ó"],
    ["Ãš", "Ú"], ["Ã‡", "Ç"], ["Â©", "©"], ["Â·", "·"],
  ];
  for (const [bad, good] of replacements) text = text.split(bad).join(good);
  return text;
}
