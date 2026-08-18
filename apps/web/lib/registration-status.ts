export const REGISTRATION_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluido" },
  { value: "rejeitado", label: "Rejeitado" },
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS_OPTIONS)[number]["value"];

const ALLOWED_STATUSES = new Set<RegistrationStatus>(
  REGISTRATION_STATUS_OPTIONS.map((option) => option.value),
);

export function normalizeRegistrationStatus(value: unknown): RegistrationStatus {
  const status = String(value ?? "");
  return ALLOWED_STATUSES.has(status as RegistrationStatus)
    ? status as RegistrationStatus
    : "pendente";
}

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return ALLOWED_STATUSES.has(String(value) as RegistrationStatus);
}
