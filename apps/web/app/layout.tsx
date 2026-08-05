import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AeR Digital — Audiolink Brasil",
  description:
    "SaaS multi-tenant para selos e gravadoras brasileiras. Artistas enviam lançamentos pelo WhatsApp; o A&R gerencia licenciamento, registro e distribuição num CRM web.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
