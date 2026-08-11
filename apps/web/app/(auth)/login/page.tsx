import { login } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-fg">AeR Digital</h1>
          <p className="text-sm text-fg-muted mt-2">
            Faça login para acessar o painel
          </p>
        </div>

        <form
          action={login}
          className="bg-surface border border-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full px-3 py-2 bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-brand hover:bg-brand-hover text-white font-medium rounded-md transition-colors"
          >
            Enviar link mágico
          </button>

          <p className="text-xs text-fg-muted text-center">
            Você receberá um email com um link de acesso. Não precisa de senha.
          </p>
        </form>
      </div>
    </div>
  );
}
