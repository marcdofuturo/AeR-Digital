"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12 text-warning" />
        </div>
        <h1 className="text-xl font-bold text-fg mb-2">Algo deu errado</h1>
        <p className="text-sm text-fg-muted mb-6">
          {error.message || "Um erro inesperado ocorreu. Tente novamente."}
        </p>
        <Button onClick={reset} variant="outline">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
