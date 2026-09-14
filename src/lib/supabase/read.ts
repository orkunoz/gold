import "server-only";

type ReadError = {
  code?: string | null;
  status?: number | null;
};

type ReadResult = { error: ReadError | null };

const TRANSIENT_CODES = new Set([
  "PGRST000",
  "PGRST001",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);

export type ReadFailureKind = "authorization" | "configuration" | "temporary" | "persistent";

export function classifyReadError(error: ReadError): ReadFailureKind {
  const code = error.code ?? "";
  const status = error.status ?? 0;
  if (status === 401 || status === 403 || code === "42501") return "authorization";
  if (code === "PGRST100" || code === "PGRST202" || code === "42883") return "configuration";
  if (status === 408 || status === 429 || status >= 500 || TRANSIENT_CODES.has(code) || code.startsWith("08")) return "temporary";
  return "persistent";
}

function logReadFailure(operation: string, error: ReadError, attempt: number) {
  console.error("supabase_read_failure", {
    operation,
    attempt,
    kind: classifyReadError(error),
    code: error.code ?? "unknown",
    status: error.status ?? null,
  });
}

/** Runs a Supabase read again once only when the returned error is transient. */
export async function readWithRetry<T extends ReadResult>(operation: string, read: () => PromiseLike<T>): Promise<T> {
  let result = await read();
  if (!result.error) return result;

  logReadFailure(operation, result.error, 1);
  if (classifyReadError(result.error) !== "temporary") return result;

  result = await read();
  if (result.error) logReadFailure(operation, result.error, 2);
  return result;
}

