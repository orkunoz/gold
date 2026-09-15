import "server-only";

type InventoryMutationOperation = "create" | "create_batch" | "update" | "permanent_delete" | "bulk_move" | "bulk_price_change" | "bulk_delete" | "import_execute";

export function inventoryMutationTimer(operation: InventoryMutationOperation) {
  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  function log(phase: string, phaseStartedAt: number) {
    console.info("inventory_mutation_timing", { operation, phase, duration_ms: Math.round((performance.now() - phaseStartedAt) * 10) / 10, correlation_id: correlationId });
  }
  return {
    async phase<T>(name: string, work: () => PromiseLike<T>): Promise<T> {
      const phaseStartedAt = performance.now();
      try { return await work(); } finally { log(name, phaseStartedAt); }
    },
    phaseSync<T>(name: string, work: () => T): T {
      const phaseStartedAt = performance.now();
      try { return work(); } finally { log(name, phaseStartedAt); }
    },
    mark(name: string) { log(name, performance.now()); },
    finish() { log("action_total", startedAt); },
  };
}
