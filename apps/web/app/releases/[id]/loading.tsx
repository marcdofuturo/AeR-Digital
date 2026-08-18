export default function ReleaseLoading() {
  return (
    <div aria-label="Carregando lancamento" className="space-y-5 p-6 animate-pulse motion-reduce:animate-none">
      <div className="h-8 w-64 rounded bg-surface-2" />
      <div className="h-10 rounded bg-surface-2/80" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-40 rounded-lg bg-surface-2/70" />
        <div className="h-40 rounded-lg bg-surface-2/70" />
        <div className="h-40 rounded-lg bg-surface-2/70" />
      </div>
    </div>
  );
}
