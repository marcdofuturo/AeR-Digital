// ─── Follow-up Reminder Engine ──────────────────────────────
import type { EmailSender } from "./email";

export interface RecipientState {
  id: string;
  name: string;
  email: string;
  reply_token: string;
  status: "enviado" | "entregue" | "aberto";
  attempts: number;
  last_sent_at: Date;
  next_reminder_at: Date;
}

export interface FollowUpConfig {
  interval_days: number;
  max_attempts: number;
}

const REMINDER_MESSAGES = [
  // Level 1 — cordial
  `Olá! Só um lembrete gentil sobre a autorização do lançamento. Se já respondeu, desconsidere. Obrigado!`,
  // Level 2 — reforça data
  `Reforçando: o lançamento está se aproximando e precisamos da sua confirmação para não atrasar. Qualquer dúvida, é só falar.`,
  // Level 3 — avisa adiamento
  `Último aviso: sem a autorização, o lançamento pode ser adiado. Se puder responder hoje, agradecemos muito!`,
  // Level 4 — escala ao A&R
  `Infelizmente não tivemos retorno e o A&R responsável foi notificado. Se ainda quiser prosseguir, responda este email que damos continuidade.`,
];

/**
 * Calculate the next reminder datetime.
 * Only sends during business hours (09:00–19:00, Mon–Fri, America/Sao_Paulo).
 */
export function nextBusinessTime(from: Date, daysAhead: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + daysAhead);

  // Ensure business hours
  const hour = next.getHours();
  if (hour < 9) next.setHours(9, 0, 0, 0);
  else if (hour >= 19) {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  }

  // Skip weekends
  const dow = next.getDay(); // 0=Sun, 6=Sat
  if (dow === 0) {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  } else if (dow === 6) {
    next.setDate(next.getDate() + 2);
    next.setHours(9, 0, 0, 0);
  }

  // If still outside business hours (edge case), push to next day 9am
  if (next.getHours() < 9 || next.getHours() >= 19) {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  }

  return next;
}

export function getReminderMessage(attempts: number): string {
  const idx = Math.min(attempts - 1, REMINDER_MESSAGES.length - 1);
  return REMINDER_MESSAGES[idx]!;
}

/**
 * Process pending reminders and return actions to take.
 * Pure function — no side effects.
 */
export function processReminders(
  recipients: RecipientState[],
  now: Date,
  config: FollowUpConfig,
): Array<{ recipient: RecipientState; message: string }> {
  const actions: Array<{ recipient: RecipientState; message: string }> = [];

  for (const r of recipients) {
    // Skip if not in a remindable state
    if (!["enviado", "entregue", "aberto"].includes(r.status)) continue;
    // Skip if max attempts reached
    if (r.attempts >= config.max_attempts) continue;
    // Skip if not yet time
    if (r.next_reminder_at > now) continue;

    actions.push({
      recipient: r,
      message: getReminderMessage(r.attempts + 1),
    });
  }

  return actions;
}

/**
 * Apply reminder action: update recipient state for next cycle.
 */
export function applyReminder(r: RecipientState, config: FollowUpConfig): RecipientState {
  const newAttempts = r.attempts + 1;
  const status = newAttempts >= config.max_attempts ? "enviado" as const : r.status;

  return {
    ...r,
    attempts: newAttempts,
    last_sent_at: new Date(),
    next_reminder_at: nextBusinessTime(new Date(), config.interval_days),
    status: newAttempts >= config.max_attempts ? r.status : status,
  };
}
