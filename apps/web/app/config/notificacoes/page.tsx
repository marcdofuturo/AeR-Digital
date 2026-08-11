import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

type NotificationSettings = {
  reminder_interval_days: number;
  reminder_max_attempts: number;
  pitch_min_lead_days: number;
};

type NotificationsPageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const settings = await getNotificationSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notificacoes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveNotifications} className="space-y-4">
          <NumberField
            label="Intervalo de follow-up (dias)"
            name="reminder_interval_days"
            min={1}
            max={30}
            defaultValue={settings.reminder_interval_days}
          />
          <NumberField
            label="Maximo de tentativas"
            name="reminder_max_attempts"
            min={1}
            max={20}
            defaultValue={settings.reminder_max_attempts}
          />
          <NumberField
            label="Minimo para pitching (dias antes do lancamento)"
            name="pitch_min_lead_days"
            min={0}
            max={60}
            defaultValue={settings.pitch_min_lead_days}
          />

          {params.error ? (
            <p role="alert" className="text-sm text-red-400">
              {params.error}
            </p>
          ) : null}
          {params.saved ? (
            <p role="status" className="text-sm text-emerald-400">
              Configuracoes salvas.
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit">Salvar notificacoes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NumberField({
  label,
  name,
  min,
  max,
  defaultValue,
}: {
  label: string;
  name: keyof NotificationSettings;
  min: number;
  max: number;
  defaultValue: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-fg mb-1">
        {label}
      </label>
      <Input id={name} name={name} type="number" min={min} max={max} defaultValue={defaultValue} required />
    </div>
  );
}

async function getNotificationSettings(): Promise<NotificationSettings> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return {
      reminder_interval_days: 5,
      reminder_max_attempts: 6,
      pitch_min_lead_days: 10,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("label_split_settings")
    .select("reminder_interval_days, reminder_max_attempts, pitch_min_lead_days")
    .eq("tenant_id", tenantId)
    .single();

  return {
    reminder_interval_days: data?.reminder_interval_days ?? 5,
    reminder_max_attempts: data?.reminder_max_attempts ?? 6,
    pitch_min_lead_days: data?.pitch_min_lead_days ?? 10,
  };
}

async function saveNotifications(formData: FormData) {
  "use server";

  const tenantId = await getCurrentTenantId();
  if (!tenantId) redirect("/onboarding");

  const settings: NotificationSettings = {
    reminder_interval_days: boundedInt(formData.get("reminder_interval_days"), 1, 30, 5),
    reminder_max_attempts: boundedInt(formData.get("reminder_max_attempts"), 1, 20, 6),
    pitch_min_lead_days: boundedInt(formData.get("pitch_min_lead_days"), 0, 60, 10),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("label_split_settings")
    .upsert({ tenant_id: tenantId, ...settings }, { onConflict: "tenant_id" });

  if (error) {
    redirect(`/config/notificacoes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/config/notificacoes");
  redirect("/config/notificacoes?saved=1");
}

function boundedInt(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
