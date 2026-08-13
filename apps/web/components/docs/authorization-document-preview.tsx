import type { AuthorizationDocumentData, AuthorizationSplitRow } from "@/lib/docs/authorization-document";
import { buildAuthorizationSections } from "@/lib/docs/authorization-document";

export function AuthorizationDocumentPreview({ data }: { data: AuthorizationDocumentData }) {
  return (
    <article className="mx-auto max-w-[820px] rounded-md border border-border bg-[#111418] px-8 py-10 text-[15px] leading-7 text-fg shadow-xl sm:px-12">
      {buildAuthorizationSections(data).map((section, index) => {
        if (section.kind === "paragraph") {
          return <p key={index} className="mb-4 whitespace-pre-wrap">{section.text}</p>;
        }

        if (section.kind === "heading") {
          return <h2 key={index} className="mb-4 mt-7 text-base font-bold text-fg">{section.text}</h2>;
        }

        if (section.kind === "kvTable") {
          return (
            <table key={index} className="mb-7 w-full border-collapse text-sm">
              <tbody>
                {section.rows.map(([label, value]) => (
                  <tr key={label}>
                    <th className="w-48 border border-border bg-surface px-3 py-2 text-left font-semibold text-fg">{label}</th>
                    <td className="border border-border px-3 py-2 text-fg">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }

        if (section.kind === "splitTable") {
          return <SplitTable key={index} title={section.title} rows={section.rows} />;
        }

        return (
          <ul key={index} className="mb-5 list-disc space-y-1 pl-5">
            {section.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        );
      })}
    </article>
  );
}

function SplitTable({ title, rows }: { title: string; rows: AuthorizationSplitRow[] }) {
  return (
    <section className="mb-7">
      <h3 className="mb-3 text-base font-bold text-fg">{title}</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-surface">
            <th className="w-14 border border-border px-3 py-2 text-left font-semibold text-fg">ID</th>
            <th className="border border-border px-3 py-2 text-left font-semibold text-fg">Artista</th>
            <th className="border border-border px-3 py-2 text-left font-semibold text-fg">Classe</th>
            <th className="w-36 border border-border px-3 py-2 text-left font-semibold text-fg">Participação (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.id}`}>
              <td className="border border-border px-3 py-2 text-fg-muted">{row.id}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.artist}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.role}</td>
              <td className="border border-border px-3 py-2 text-fg">{row.percent}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-border px-3 py-2" />
            <td className="border border-border px-3 py-2" />
            <td className="border border-border px-3 py-2 font-bold text-fg">Total:</td>
            <td className="border border-border px-3 py-2 font-bold text-fg">100%</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
