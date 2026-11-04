export type ProductEditForm = {
  name: string;
  sku: string;
  selling_price: string;
  low_stock_threshold: string;
  active: boolean;
};

/** Returns a short reason the form can't be saved yet, or null when it is valid. */
export function productEditProblem(f: ProductEditForm): string | null {
  if (!f.name.trim()) return "Enter a name.";
  if (!f.sku.trim()) return "Enter a SKU.";
  const price = Number(f.selling_price);
  if (f.selling_price.trim() === "" || !Number.isFinite(price) || price < 0) return "Enter a valid selling price.";
  const thr = Number(f.low_stock_threshold);
  if (f.low_stock_threshold.trim() === "" || !Number.isFinite(thr) || thr < 0) return "Enter a valid low-stock level.";
  if (f.active && price <= 0) return "Set a price above 0 to sell this at the till.";
  return null;
}

/** An inactive product with no price yet is "waiting for a price" (e.g. imported from a stock sheet). */
export function isWaitingForPrice(p: { active: boolean; selling_price: number | string }): boolean {
  return !p.active && Number(p.selling_price) === 0;
}
