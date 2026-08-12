import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
          <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
            <h3 className="text-sm font-medium text-fg">Obra</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Sempre pro-rata igualitário entre todos os autores/compositores.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
            <h3 className="text-sm font-medium text-fg">Fonograma</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="font-mono text-lg font-bold text-brand">41,70%</div>
                <div className="mt-1 text-[11px] text-fg-muted">Produtor fonográfico</div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-success">41,70%</div>
                <div className="mt-1 text-[11px] text-fg-muted">Intérpretes</div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-warning">16,60%</div>
                <div className="mt-1 text-[11px] text-fg-muted">Músicos</div>
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
          <form action={saveDigitalSplitSettings} className="space-y-5">
            <fieldset className="grid gap-3 md:grid-cols-2">
              <legend className="sr-only">Modo do split digital</legend>

              <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-brand/60">
                <input
                  type="radio"
                  name="digital_mode"
                  value="fixo"
                  defaultChecked={digitalMode === "fixo"}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">Percentual fixo</span>
                  <span className="mt-1 block text-xs text-fg-muted">
                    O selo fica com o percentual informado; o restante é distribuído pro-rata entre os participantes da faixa.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-bg p-4 transition-colors hover:border-brand/60">
                <input
                  type="radio"
                  name="digital_mode"
                  value="pro_rata"
                  defaultChecked={digitalMode === "pro_rata"}
                  className="mt-1 accent-brand"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">Pro-rata automático</span>
                  <span className="mt-1 block text-xs text-fg-muted">
                    Os 100% são divididos automaticamente entre os participantes da faixa mais o selo.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="max-w-xs">
              <label htmlFor="digital_label_percent" className="block text-sm font-medium text-fg mb-1">
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
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
                <span className="text-sm text-fg-muted">%</span>
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                Usado apenas no modo percentual fixo.
              </p>
            </div>

            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-fg-muted">
              Esta configuração será aplicada automaticamente somente às músicas que chegarem a partir deste momento.
              Para lançamentos já cadastrados, ajuste a aba Splits da própria música e confirme manualmente.
            </div>

            <Button type="submit">Salvar configuração</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
