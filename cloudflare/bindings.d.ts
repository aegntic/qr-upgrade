// Binding-only structural types; the generated CloudflareEnv declares their names.
// Runtime globals come from the existing Node/DOM type libraries.
interface RateLimit { limit(input: { key: string }): Promise<{ success: boolean }> }
interface Fetcher { fetch: typeof fetch }
