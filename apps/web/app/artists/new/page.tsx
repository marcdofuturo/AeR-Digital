import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/forms/save-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";

type NewArtistPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewArtistPage({ searchParams }: NewArtistPageProps) {
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/artists">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-fg text-2xl font-bold">Novo artista</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Cadastre ou complete um artista antes de vincular ao catalogo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do artista</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createArtist} className="space-y-4">
            <Field label="Nome artistico" name="stage_name" required />
            <Field label="Nome civil" name="legal_name" />
            <Field label="CPF ou CNPJ" name="cpf_cnpj" />
            <Field label="Codigo ECAD" name="ecad_code" />
            <Field label="Email de liberacao" name="release_email" type="email" />
            <Field label="Telefone de contato" name="phone" />
            <Field
              label="Associacao PRO"
              name="pro_affiliation"
              placeholder="UBC, Abramus, SBACEM..."
            />
            <Field label="Spotify URL" name="spotify_url" type="url" />

            {error ? (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link href="/artists">Cancelar</Link>
              </Button>
              <SaveButton pendingLabel="Criando artista..." savedLabel="Artista criado">
                Criar artista
              </SaveButton>
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
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-fg mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  );
}

async function createArtist(formData: FormData) {
  "use server";

  const tenantId = await getCurrentTenantId();
  if (!tenantId) redirect("/onboarding");

  const stageName = String(formData.get("stage_name") ?? "").trim();
  if (!stageName) {
    redirect("/artists/new?error=Nome%20artistico%20obrigatorio");
  }

  const supabase = await createClient();
  const payload = {
    tenant_id: tenantId,
    stage_name: stageName,
    legal_name: nullableText(formData.get("legal_name")),
    cpf_cnpj: nullableText(formData.get("cpf_cnpj")),
    ecad_code: nullableText(formData.get("ecad_code")),
    pro_affiliation: nullableText(formData.get("pro_affiliation")),
    spotify_url: nullableText(formData.get("spotify_url")),
    needs_review: !nullableText(formData.get("legal_name")),
  };

  const { data, error } = await supabase.from("artists").insert(payload).select("id").single();

  if (error || !data) {
    redirect(`/artists/new?error=${encodeURIComponent(error?.message ?? "Erro ao criar artista")}`);
  }

  const contacts: Array<{
    artist_id: string;
    kind: "email" | "whatsapp";
    value: string;
    label: string;
    is_primary: boolean;
  }> = [];
  const releaseEmail = nullableText(formData.get("release_email"));
  const phone = nullableText(formData.get("phone"));
  if (releaseEmail) {
    contacts.push({
      artist_id: data.id,
      kind: "email",
      value: releaseEmail,
      label: "Liberacao",
      is_primary: true,
    });
  }
  if (phone) {
    contacts.push({
      artist_id: data.id,
      kind: "whatsapp",
      value: phone,
      label: "Contato",
      is_primary: true,
    });
  }
  if (contacts.length) {
    const { error: contactError } = await supabase.from("artist_contacts").insert(contacts);
    if (contactError) {
      redirect(
        `/artists/${data.id}?error=${encodeURIComponent("Artista criado; revise os contatos")}`,
      );
    }
  }

  revalidatePath("/artists");
  redirect(`/artists/${data.id}`);
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}
