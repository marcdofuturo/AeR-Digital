import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-md mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-fg">Criar seu selo</h1>
          <p className="text-sm text-fg-muted mt-2">
            Configure sua gravadora ou selo para começar
          </p>
        </div>

        <form
          action={createTenant}
          className="bg-surface border border-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-fg mb-1">
              Nome do selo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="SuperTime Digital"
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-fg mb-1">
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              pattern="[a-z0-9-]+"
              placeholder="supertime"
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
            <p className="text-xs text-fg-muted mt-1">
              Apenas letras minúsculas, números e hífen. Ex: supertime
            </p>
          </div>

          <div>
            <label htmlFor="legal_name" className="block text-sm font-medium text-fg mb-1">
              Razão social
            </label>
            <input
              id="legal_name"
              name="legal_name"
              type="text"
              placeholder="SuperTime Digital Ltda"
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="cnpj" className="block text-sm font-medium text-fg mb-1">
              CNPJ
            </label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              placeholder="00.000.000/0000-00"
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-2">
              Rateio digital
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <input type="radio" name="digital_mode" value="fixo" defaultChecked className="accent-brand" />
                Fixo — o selo recebe uma % fixa; o resto é rateado entre os artistas
              </label>
              <label className="flex items-center gap-2 text-sm text-fg-muted">
                <input type="radio" name="digital_mode" value="pro_rata" className="accent-brand" />
                Pro-rata — o selo entra como mais um participante no rateio
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="digital_label_bps100" className="block text-sm font-medium text-fg mb-1">
              % do selo no digital (se modo fixo)
            </label>
            <input
              id="digital_label_bps100"
              name="digital_label_bps100"
              type="number"
              defaultValue={25}
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-brand hover:bg-brand-hover text-white font-medium rounded-md transition-colors"
          >
            Criar selo
          </button>
        </form>
      </div>
    </div>
  );
}

async function createTenant(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const legal_name = (formData.get("legal_name") as string) || null;
  const cnpj = (formData.get("cnpj") as string) || null;
  const digital_mode = (formData.get("digital_mode") as "fixo" | "pro_rata") || "fixo";
  const digital_label_bps100 = Math.round(
    (Number(formData.get("digital_label_bps100")) || 25) * 100,
  ); // convert % to bps100

  // Generate a unique intake code
  const intake_code = `#${slug.slice(0, 4).toUpperCase().padEnd(4, "X").replace(/[^A-Z0-9]/g, "X")}`;

  // Create tenant
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .insert({
      slug,
      name,
      legal_name,
      cnpj,
      intake_code,
    })
    .select("id")
    .single();

  if (tenantErr) {
    redirect(`/onboarding?error=${encodeURIComponent(tenantErr.message)}`);
  }

  // Create profile if not exists
  await admin.from("profiles").upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? name,
    email: user.email!,
  });

  // Create membership
  await admin.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
    is_default_ar: true,
  });

  // Create default split settings
  await admin.from("label_split_settings").insert({
    tenant_id: tenant.id,
    digital_mode,
    digital_label_bps100,
  });

  revalidatePath("/");
  redirect("/");
}
