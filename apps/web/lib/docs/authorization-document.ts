import { buildSimpleDocx, type DocxBlock } from "./simple-docx";

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

export function buildAuthorizationDocumentData({
  release,
  track,
  tenant,
}: {
  release: any;
  track: any;
  tenant: any;
}): AuthorizationDocumentData {
  const labelName = tenant?.name ?? "Audiolink Brasil";
  const participants = [...(track.track_participants ?? [])]
    .sort((a: Participant, b: Participant) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const artistById = new Map<string, string>();
  for (const participant of participants) {
    const artist = participant.artists ?? {};
    if (participant.artist_id) {
      artistById.set(String(participant.artist_id), artist.legal_name || artist.stage_name || "Participante");
    }
  }

  const artists = participants
    .map((participant: Participant) => participant.artists?.stage_name || participant.artists?.legal_name)
    .filter(Boolean)
    .join(", ");

  return {
    representativeName: tenant?.legal_name || labelName,
    labelName,
    releaseTitle: release.title ?? track.title ?? "Lançamento",
    trackTitle: track.title ?? release.title ?? "Faixa",
    artists: artists || "Artistas não informados",
    releaseDate: formatDate(release.release_date),
    distributor: release.distributor ?? "Audiolink Brasil",
    isrc: track.isrc ?? "a gerar",
    albumId: release.album_id_ext ?? release.upc ?? "a gerar",
    trackLink: track.audio_url ?? "",
    splits: {
      obra: splitRows(track.splits ?? [], "obra", artistById, labelName),
      fonograma: splitRows(track.splits ?? [], "fonograma", artistById, labelName),
      digital: splitRows(track.splits ?? [], "digital", artistById, labelName),
    },
  };
}

export function buildAuthorizationMarkdown(data: AuthorizationDocumentData) {
  return [
    "Olá, pessoal!",
    "Espero que estejam bem.",
    "",
    `Sou o ${data.representativeName} e neste documento represento a empresa e seus artistas ${data.artists}.`,
    "Venho por meio deste solicitar, de forma oficial, a autorização para o lançamento digital da faixa abaixo;",
    "",
    "Todos os detalhes do lançamento seguem especificados a seguir:",
    "",
    "**Autorização de Distribuição Digital**",
    "",
    tableMarkdown([
      ["Nome da Faixa:", data.trackTitle],
      ["Artistas:", data.artists],
      ["Data de Lançamento:", data.releaseDate],
      ["Agregadora:", data.distributor],
      ["ISRC:", data.isrc],
      ["ID do Álbum:", data.albumId],
      ["Link da Faixa:", data.trackLink || "a inserir"],
    ]),
    "",
    splitSectionMarkdown("Obra", data.splits.obra),
    "",
    splitSectionMarkdown("Fonograma", data.splits.fonograma),
    "",
    splitSectionMarkdown("Digital", data.splits.digital),
    "",
    "Caso todos estejam de acordo com o lançamento, por gentileza, responder este e-mail com a seguinte mensagem:",
    "",
    `"Eu, [NOME] sou responsável pelo [ARTISTA], autorizo este lançamento."`,
    "",
    "Solicito também que seja preenchido o nosso formulário de cadastro:",
    "",
    "- CPF",
    "- E-mails para repasse de royalties e respectivas porcentagens de empresários e agenciadores",
    "- Telefone para contato (WhatsApp)",
    "",
    "Qualquer dúvida, estou à disposição.",
  ].join("\n");
}

export function buildAuthorizationDocx(data: AuthorizationDocumentData) {
  return buildSimpleDocx(buildDocxBlocks(data));
}

function buildDocxBlocks(data: AuthorizationDocumentData): DocxBlock[] {
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
    { kind: "heading", text: "Autorização de Distribuição Digital", level: 1 },
    {
      kind: "table",
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
    splitSectionDocx("Obra", data.splits.obra),
    splitSectionDocx("Fonograma", data.splits.fonograma),
    splitSectionDocx("Digital", data.splits.digital),
    {
      kind: "paragraph",
      text: 'Caso todos estejam de acordo com o lançamento, responder este e-mail com: "Eu, [NOME] sou responsável pelo [ARTISTA], autorizo este lançamento."',
    },
    {
      kind: "paragraph",
      text: "Solicito também CPF, e-mails para repasse de royalties e telefone para contato (WhatsApp).",
    },
    { kind: "paragraph", text: "Qualquer dúvida, estou à disposição." },
  ];
}

function splitSectionDocx(title: string, rows: AuthorizationSplitRow[]): DocxBlock {
  return {
    kind: "table",
    rows: [
      [title, "", "", ""],
      ["ID", "Artista", "Classe", "Participação (%)"],
      ...rows.map((row) => [String(row.id), row.artist, row.role, row.percent]),
      ["", "", "Total:", "100%"],
    ],
  };
}

function splitRows(splits: SplitLine[], scope: string, artistById: Map<string, string>, labelName: string) {
  const latest = latestSplits(splits, scope);
  return latest.map((line, index) => ({
    id: index + 1,
    artist: line.holder_type === "label"
      ? labelName
      : artistById.get(String(line.artist_id)) ?? "Participante",
    role: normalizeFonogramaRole(line.role_label),
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

function formatDate(value: string | null | undefined) {
  if (!value) return "a definir";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function formatPercent(bps100: number) {
  return `${(Number(bps100) / 100).toFixed(2).replace(".", ",")}%`;
}

function normalizeFonogramaRole(role: string) {
  return role === "Músico" ? "Músico acompanhante" : role;
}
