export type InventoryLocation = { id: string; name: string; code?: string | null; location_type?: string | null; is_active: boolean };
export type InventoryLocationCount = { shop_id: string; in_stock_count: number };

export function inventoryDistribution(locations: InventoryLocation[], counts: InventoryLocationCount[]) {
  const countByLocation = new Map(counts.map(row => [row.shop_id, Number(row.in_stock_count) || 0]));
  const active = locations.filter(location => location.is_active).map(location => ({
    id: location.id,
    name: location.name,
    code: location.code ?? null,
    location_type: location.location_type ?? null,
    inStock: countByLocation.get(location.id) ?? 0,
  }));
  const totalInStock = active.reduce((total, location) => total + location.inStock, 0);
  return active.map(location => ({
    ...location,
    totalInStock,
    percentage: totalInStock > 0 ? location.inStock / totalInStock * 100 : 0,
  }));
}
