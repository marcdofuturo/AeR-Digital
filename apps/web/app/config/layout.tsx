export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 max-w-[1100px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Configurações</h1>
        <p className="text-sm text-fg-muted mt-1">
          Gerencie as configurações do seu selo
        </p>
      </div>
      {children}
    </div>
  );
}
