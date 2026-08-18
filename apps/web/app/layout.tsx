import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/nav/app-shell";
import { NavigationFeedback } from "@/components/nav/navigation-feedback";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeR Digital — Audiolink Brasil",
  description:
    "SaaS multi-tenant para selos e gravadoras brasileiras. Artistas enviam lançamentos pelo WhatsApp; o A&R gerencia licenciamento, registro e distribuição num CRM web.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
