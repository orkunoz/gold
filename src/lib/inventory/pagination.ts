export function inventoryOrdinal(page: number, pageSize: number, index: number) {
  return (Math.max(1, page) - 1) * pageSize + index + 1;
}

export function inventoryResultSummary(page: number, pageSize: number, count: number, loaded: number) {
  if (count === 0) return "0 products";
  const first = (Math.max(1, page) - 1) * pageSize + 1;
  return `Showing ${first}–${first + Math.max(0, loaded - 1)} of ${count} products`;
}
