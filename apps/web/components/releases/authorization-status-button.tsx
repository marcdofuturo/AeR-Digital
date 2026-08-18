import { setAuthorizationRecipientStatus } from "@/app/releases/actions";
import { SaveButton } from "@/components/forms/save-button";

export function AuthorizationStatusButton({
  releaseId,
  recipientId,
  approved,
}: {
  releaseId: string;
  recipientId: string;
  approved: boolean;
}) {
  const nextStatus = approved ? "pendente" : "aprovado";
  return (
    <form action={setAuthorizationRecipientStatus}>
      <input type="hidden" name="release_id" value={releaseId} />
      <input type="hidden" name="recipient_id" value={recipientId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SaveButton
        size="sm"
        variant="outline"
        pendingLabel="Atualizando..."
        savedLabel="Atualizado"
      >
        {approved ? "Marcar pendente" : "Marcar OK"}
      </SaveButton>
    </form>
  );
}
