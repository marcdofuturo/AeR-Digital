import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <FileQuestion className="h-12 w-12 text-fg-muted" />
        </div>
        <h1 className="text-xl font-bold text-fg mb-2">Página não encontrada</h1>
        <p className="text-sm text-fg-muted mb-6">
          A página que você procura não existe ou foi removida.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Voltar ao Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
