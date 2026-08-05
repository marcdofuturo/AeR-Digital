// Claude clients + prompts versionados
// Implementation in Prompt 2

export interface AiClient {
  validate(input: string, prompt: string): Promise<unknown>;
  classify(input: string, prompt: string): Promise<unknown>;
  synthesize(context: Record<string, unknown>): Promise<unknown>;
}
