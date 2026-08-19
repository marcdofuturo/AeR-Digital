export type PresentationJob = {
  id: string;
  tenantId: string;
  releaseId: string;
  trackId: string;
  audioUrl: string;
  title: string;
  releaseDate: string;
  genres: string[];
  participants: string[];
  userGuidance: string | null;
};

export type AudioAnalysis = {
  transcript: string;
  bpm: number;
  key: string;
  mode: "major" | "minor";
  energy: number;
  brightness: number;
  duration: number;
  hook_at_sec: number;
  segments: Array<{ start: number; end: number; text: string }>;
  errors: string[];
};

export type PresentationInput = PresentationJob & AudioAnalysis;

export type PresentationResult = {
  apresentacao: string;
  avisos: string[];
  fontes: Array<{ titulo: string; url: string }>;
  raw: string;
};

export type PresentationProcessorDependencies = {
  ready(): Promise<void>;
  claim(): Promise<PresentationJob | null>;
  analyze(job: PresentationJob): Promise<AudioAnalysis>;
  saveAnalysis(job: PresentationJob, analysis: AudioAnalysis): Promise<void>;
  generate(input: PresentationInput): Promise<PresentationResult>;
  complete(job: PresentationJob, result: PresentationResult): Promise<void>;
  fail(job: PresentationJob, safeMessage: string): Promise<void>;
};

export async function processNextPresentationJob(
  dependencies: PresentationProcessorDependencies,
): Promise<boolean> {
  await dependencies.ready();
  const job = await dependencies.claim();
  if (!job) return false;

  let analysis: AudioAnalysis;
  try {
    analysis = await dependencies.analyze(job);
  } catch {
    await dependencies.fail(job, "Falha ao analisar o audio da faixa");
    return true;
  }

  try {
    await dependencies.saveAnalysis(job, analysis);
  } catch {
    await dependencies.fail(job, "Falha ao salvar a analise de audio");
    return true;
  }

  let result: PresentationResult;
  try {
    result = await dependencies.generate({ ...job, ...analysis });
  } catch {
    await dependencies.fail(job, "Falha ao gerar a apresentacao com IA");
    return true;
  }

  try {
    await dependencies.complete(job, result);
  } catch {
    await dependencies.fail(job, "Falha ao salvar a apresentacao gerada");
  }
  return true;
}
