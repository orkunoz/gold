export function netProfitTone(value: number) {
  if (value > 0) return "zl-success";
  if (value < 0) return "zl-danger";
  return "text-stone-950";
}
