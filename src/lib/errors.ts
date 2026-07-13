export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.trim();
  if (typeof err === "string") return err.trim();
  if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; error?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message.trim();
    if (typeof maybe.error === "string" && maybe.error.trim()) return maybe.error.trim();
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? "").trim();
}
