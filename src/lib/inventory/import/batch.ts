export const IMPORT_BATCH_SIZE = 100;

export function batchImportRows<T>(rows: T[], size = IMPORT_BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1) throw new Error("Batch size must be positive.");
  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += size) batches.push(rows.slice(index, index + size));
  return batches;
}
