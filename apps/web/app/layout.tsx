import type { Metadata } from "next";
import { Sidebar } from "@/components/nav/sidebar";
import { UserMenu } from "@/components/nav/user-menu";
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-fg min-h-screen flex font-sans antialiased">
        {/* Authenticated shell — sidebar + content */}
        <Sidebar />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </body>
    </html>
  );
}
