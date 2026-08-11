import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

const REGISTRATION_KINDS = [
  "obra_ecad",
  "fonograma_ecad",
  "isrc",
  "distribuicao",
  "youtube_cid",
];

type NewReleasePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewReleasePage({ searchParams }: NewReleasePageProps) {
  const { error } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/releases">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-fg">Novo lancamento</h1>
          <p className="text-sm text-fg-muted mt-1">
            Crie um rascunho de catalogo para completar creditos, splits e registros.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados iniciais</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRelease} className="space-y-4">
            <Field label="Titulo" name="title" required />
            <Field label="Data de lancamento" name="release_date" type="date" defaultValue={today} required />
            <Field label="Genero principal" name="genre_primary" placeholder="Funk, Trap, Pop..." />
            <Field label="Genero secundario" name="genre_secondary" />

            {error ? (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/releases">Cancelar</Link>
              </Button>
              <Button type="submit">Criar lancamento</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-fg mb-1">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}

async function createRelease(formData: FormData) {
  "use server";

  const tenantId = await getCurrentTenantId();
  if (!tenantId) redirect("/onboarding");

  const title = String(formData.get("title") ?? "").trim();
  const releaseDate = String(formData.get("release_date") ?? "").trim();

  if (!title || !releaseDate) {
    redirect("/releases/new?error=Titulo%20e%20data%20sao%20obrigatorios");
  }

  const supabase = await createClient();
  const { data: release, error: releaseError } = await supabase
    .from("releases")
    .insert({
      tenant_id: tenantId,
      title,
      release_date: releaseDate,
      genre_primary: nullableText(formData.get("genre_primary")),
      genre_secondary: nullableText(formData.get("genre_secondary")),
      distributor: "Audiolink Brasil",
      stage: "recebido",
    })
    .select("id")
    .single();

  if (releaseError || !release) {
    redirect(`/releases/new?error=${encodeURIComponent(releaseError?.message ?? "Erro ao criar lancamento")}`);
  }

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .insert({
      tenant_id: tenantId,
      release_id: release.id,
      title,
    })
    .select("id")
    .single();

  if (trackError || !track) {
    redirect(`/releases/${release.id}`);
  }

  await supabase.from("registrations").insert(
    REGISTRATION_KINDS.map((kind) => ({
      tenant_id: tenantId,
      track_id: track.id,
      kind,
    })),
  );

  revalidatePath("/releases");
  redirect(`/releases/${release.id}`);
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}
