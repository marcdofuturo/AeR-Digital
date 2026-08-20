import { buildSimpleDocx, type DocxBlock } from "./simple-docx";
import { buildAuthorizationTablePdf } from "./authorization-pdf";

export type AuthorizationSplitLine = {
  scope?: string;
  holder_type: "artist" | "label";
  artist_id?: string | null;
  role_label: string;
  bps100: number;
  version?: number;
};

export type AuthorizationParticipant = {
  artist_id?: string | null;
  position?: number | null;
  artists?: AuthorizationArtist | AuthorizationArtist[] | null;
};

type AuthorizationArtist = {
  id?: string;
  stage_name?: string | null;
  legal_name?: string | null;
};

export type AuthorizationReleaseSource = {
  id?: string;
  title?: string | null;
  release_date?: string | null;
  distributor?: string | null;
  upc?: string | null;
  album_id_ext?: string | null;
};

export type AuthorizationTrackSource = {
  id?: string;
  title?: string | null;
  isrc?: string | null;
  track_participants?: AuthorizationParticipant[] | null;
  splits?: AuthorizationSplitLine[] | null;
};

export type AuthorizationTenantSource = {
  id?: string;
  name?: string | null;
  legal_name?: string | null;
  responsible_name?: string | null;
  representative_name?: string | null;
  legal_representative?: string | null;
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
  release: AuthorizationReleaseSource;
  track: AuthorizationTrackSource;
  tenant: AuthorizationTenantSource | null;
}): AuthorizationDocumentData {
  const labelName = cleanHumanText(tenant?.name ?? "Audiolink Brasil");
  const participants = [...(track.track_participants ?? [])].sort(
    (a: AuthorizationParticipant, b: AuthorizationParticipant) =>
      Number(a.position ?? 0) - Number(b.position ?? 0),
  );
  const artistById = new Map<string, string>();

  for (const participant of participants) {
    const artist = participantArtist(participant) ?? {};
    if (participant.artist_id) {
      artistById.set(
        String(participant.artist_id),
        cleanHumanText(artist.legal_name || artist.stage_name || "Participante"),
      );
    }
  }

  const artists = participants
    .map((participant: AuthorizationParticipant) => {
      const artist = participantArtist(participant);
      return artist?.stage_name || artist?.legal_name;
    })
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
    splits: {
      obra: splitRows(track.splits ?? [], "obra", artistById, labelName),
      fonograma: splitRows(track.splits ?? [], "fonograma", artistById, labelName),
      digital: splitRows(track.splits ?? [], "digital", artistById, labelName),
    },
  };
}

export function buildAuthorizationSections(
  data: AuthorizationDocumentData,
): AuthorizationSection[] {
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
      ],
    },
    { kind: "splitTable", title: "Obra", rows: data.splits.obra },
    { kind: "splitTable", title: "Fonograma", rows: data.splits.fonograma },
    { kind: "splitTable", title: "Digital", rows: data.splits.digital },
    {
      kind: "paragraph",
      text: "Caso todos estejam de acordo com o lançamento, por gentileza, responder este e-mail com a seguinte mensagem:",
    },
    {
      kind: "paragraph",
      text: `"Eu, [NOME] sou responsável pelo [ARTISTA], autorizo este lançamento."`,
    },
    {
      kind: "paragraph",
      text: "Solicito também que seja preenchido o nosso formulário de cadastro:",
    },
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
  return buildAuthorizationSections(data)
    .map((section) => {
      if (section.kind === "paragraph") return section.text;
      if (section.kind === "heading") return `**${section.text}**`;
      if (section.kind === "kvTable") return tableMarkdown(section.rows);
      if (section.kind === "splitTable") return splitSectionMarkdown(section.title, section.rows);
      return section.items.map((item) => `* ${item}`).join("\n");
    })
    .join("\n\n");
}

export function buildAuthorizationDocx(data: AuthorizationDocumentData) {
  return buildSimpleDocx(buildDocxBlocks(data));
}

export function buildAuthorizationPdf(data: AuthorizationDocumentData) {
  return buildAuthorizationTablePdf(buildAuthorizationSections(data));
}

function buildDocxBlocks(data: AuthorizationDocumentData): DocxBlock[] {
  return buildAuthorizationSections(data).flatMap((section): DocxBlock[] => {
    if (section.kind === "paragraph") return [{ kind: "paragraph", text: section.text }];
    if (section.kind === "heading") return [{ kind: "heading", text: section.text, level: 1 }];
    if (section.kind === "kvTable") return [{ kind: "table", rows: section.rows }];
    if (section.kind === "splitTable")
      return [
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

function splitRows(
  splits: AuthorizationSplitLine[],
  scope: string,
  artistById: Map<string, string>,
  labelName: string,
) {
  const latest = latestSplits(splits, scope);
  return latest.map((line, index) => ({
    id: index + 1,
    artist:
      line.holder_type === "label"
        ? labelName
        : (artistById.get(String(line.artist_id)) ?? "Participante"),
    role: normalizeRole(line.role_label),
    percent: formatPercent(line.bps100),
  }));
}

function latestSplits(splits: AuthorizationSplitLine[], scope: string) {
  const filtered = splits.filter((split) => split.scope === scope) as Array<
    AuthorizationSplitLine & { scope: string }
  >;
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

function participantArtist(participant: AuthorizationParticipant) {
  return Array.isArray(participant.artists) ? participant.artists[0] : participant.artists;
}

function resolveRepresentativeName(tenant: AuthorizationTenantSource | null, labelName: string) {
  if (normalizeText(labelName) === "supertime digital") return "LucIA";
  return cleanHumanText(
    tenant?.responsible_name ||
      tenant?.representative_name ||
      tenant?.legal_representative ||
      tenant?.legal_name ||
      labelName,
  );
}

function normalizeRole(role: string) {
  const cleanRole = cleanHumanText(role);
  return normalizeText(cleanRole) === "musico" ? "Músico acompanhante" : cleanRole;
}

function normalizeText(value: string) {
  return cleanHumanText(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
    ["Ã¡", "á"],
    ["Ã ", "à"],
    ["Ã¢", "â"],
    ["Ã£", "ã"],
    ["Ã©", "é"],
    ["Ãª", "ê"],
    ["Ã­", "í"],
    ["Ã³", "ó"],
    ["Ã´", "ô"],
    ["Ãµ", "õ"],
    ["Ãº", "ú"],
    ["Ã§", "ç"],
    ["Ã", "Á"],
    ["Ã‰", "É"],
    ["Ã", "Í"],
    ["Ã“", "Ó"],
    ["Ãš", "Ú"],
    ["Ã‡", "Ç"],
    ["Â©", "©"],
    ["Â·", "·"],
  ];
  for (const [bad, good] of replacements) text = text.split(bad).join(good);
  return text;
}
