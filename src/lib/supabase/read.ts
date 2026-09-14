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

type RetryOptions = {
  readOnly?: boolean;
  delayMs?: number;
  correlationId?: string;
};

export function classifyReadError(error: ReadError, readOnly = true): ReadFailureKind {
  const code = error.code ?? "";
  const status = error.status ?? 0;
  if (status === 401 || status === 403 || code === "42501") return "authorization";
  if (code === "PGRST100" || code === "PGRST202" || code === "42883") return "configuration";
  if (status === 408 || status === 429 || status >= 500 || TRANSIENT_CODES.has(code) || code.startsWith("08")) return "temporary";
  if (readOnly && status === 0 && (code === "" || code === "unknown")) return "temporary";
  return "persistent";
}

function logReadFailure(operation: string, error: ReadError, attempt: number, correlationId: string, readOnly: boolean) {
  console.error("supabase_read_failure", {
    operation,
    attempt,
    kind: classifyReadError(error, readOnly),
    code: error.code ?? "unknown",
    status: error.status ?? null,
    correlationId,
  });
}

/** Runs a read again once, after a short delay, only when its error is transient. */
export async function readWithRetry<T extends ReadResult>(operation: string, read: () => PromiseLike<T>, options: RetryOptions = {}): Promise<T> {
  const { readOnly = true, delayMs = 100, correlationId = crypto.randomUUID() } = options;
  let result = await read();
  if (!result.error) return result;

  logReadFailure(operation, result.error, 1, correlationId, readOnly);
  if (!readOnly || classifyReadError(result.error, readOnly) !== "temporary") return result;

  await new Promise(resolve => setTimeout(resolve, delayMs));
  result = await read();
  if (result.error) logReadFailure(operation, result.error, 2, correlationId, readOnly);
  return result;
}

