export { SpotifyClient, buildPitchPrompt, isEligibleForPitch } from "./pitch";
export type {
  SpotifyArtist, SpotifyTrack, AudioFeatures, AudioAnalysis, PitchContext, PitchResult,
} from "./pitch";

export {
  organizeKanban, formatDaysInStage, deadlineColor,
  validateSplitTotal, redistributeRemainder,
  computePipelineStats, taskPriorityColor, KANBAN_STAGES,
  taskStatusLabel,
} from "./crm";
export type {
  KanbanCard, KanbanColumn, SplitEditorLine,
  Task, TaskStatus, TaskPriority, PipelineStats,
} from "./crm";
