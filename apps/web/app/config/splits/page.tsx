import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditableActionForm } from "@/components/forms/editable-action-form";
import { getTenantSplitSettings } from "@/lib/tenant";
import { saveDigitalSplitSettings } from "./actions";

export default async function SplitsConfigPage() {
  const splitSettings = await getTenantSplitSettings();

  const digitalMode = splitSettings?.digital_mode ?? "fixo";
  const labelBps100 = splitSettings?.digital_label_bps100 ?? 2500;
  const labelPercent = labelBps100 / 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras fixas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="border-border/60 bg-surface-2/40 rounded-lg border p-4">
            <h3 className="text-fg text-sm font-medium">Obra</h3>
            <p className="text-fg-muted mt-2 text-sm">
              Sempre pro-rata igualitário entre todos os autores/compositores.
            </p>
          </div>

          <div className="border-border/60 bg-surface-2/40 rounded-lg border p-4">
            <h3 className="text-fg text-sm font-medium">Fonograma</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-brand font-mono text-lg font-bold">41,70%</div>
                <div className="text-fg-muted mt-1 text-[11px]">Produtor fonográfico</div>
              </div>
              <div>
                <div className="text-success font-mono text-lg font-bold">41,70%</div>
                <div className="text-fg-muted mt-1 text-[11px]">Intérpretes</div>
              </div>
              <div>
                <div className="text-warning font-mono text-lg font-bold">16,60%</div>
                <div className="text-fg-muted mt-1 text-[11px]">Músicos</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Digital</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableActionForm
            action={saveDigitalSplitSettings}
            className="space-y-5"
            fieldsClassName="space-y-5"
            editLabel="Editar configuracao"
            saveLabel="Salvar configuracao"
            savedLabel="Configuracao salva"
          >
            <fieldset className="grid gap-3 md:grid-cols-2">
              <legend className="sr-only">Modo do split digital</legend>

              <label className="border-border bg-bg hover:border-brand/60 flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors">
                <input
                  type="radio"
                  name="digital_mode"
                  value="fixo"
                  defaultChecked={digitalMode === "fixo"}
                  className="accent-brand mt-1"
                />
                <span>
                  <span className="text-fg block text-sm font-medium">Percentual fixo</span>
                  <span className="text-fg-muted mt-1 block text-xs">
                    O selo fica com o percentual informado; o restante é distribuído pro-rata entre
                    os participantes da faixa.
                  </span>
                </span>
              </label>

              <label className="border-border bg-bg hover:border-brand/60 flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors">
                <input
                  type="radio"
                  name="digital_mode"
                  value="pro_rata"
                  defaultChecked={digitalMode === "pro_rata"}
                  className="accent-brand mt-1"
                />
                <span>
                  <span className="text-fg block text-sm font-medium">Pro-rata automático</span>
                  <span className="text-fg-muted mt-1 block text-xs">
                    Os 100% são divididos automaticamente entre os participantes da faixa mais o
                    selo.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="max-w-xs">
              <label
                htmlFor="digital_label_percent"
                className="text-fg mb-1 block text-sm font-medium"
              >
                Percentual do selo
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="digital_label_percent"
                  name="digital_label_percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={labelPercent}
                  className="border-border bg-bg text-fg focus:border-brand focus:ring-brand/50 w-full rounded-md border px-3 py-2 focus:ring-2 focus:outline-none"
                />
                <span className="text-fg-muted text-sm">%</span>
              </div>
              <p className="text-fg-muted mt-2 text-xs">Usado apenas no modo percentual fixo.</p>
            </div>

            <div className="border-warning/30 bg-warning/10 text-fg-muted rounded-md border p-3 text-sm">
              Esta configuração será aplicada automaticamente somente às músicas que chegarem a
              partir deste momento. Para lançamentos já cadastrados, ajuste a aba Splits da própria
              música e confirme manualmente.
            </div>
          </EditableActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
