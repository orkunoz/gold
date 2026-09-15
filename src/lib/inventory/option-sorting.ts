const ukrainianCollator = new Intl.Collator("uk-UA", { sensitivity: "base", numeric: true });
const numericSize = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

export const compareUkrainian = (left: string, right: string) => ukrainianCollator.compare(left, right);

export function sortUkrainian(values: string[]) {
  return [...values].sort(compareUkrainian);
}

export function sortSizes(values: string[]) {
  return [...values].sort((left, right) => {
    const leftNumeric = numericSize.test(left.trim());
    const rightNumeric = numericSize.test(right.trim());
    if (leftNumeric && rightNumeric) return Number(left.trim().replace(",", ".")) - Number(right.trim().replace(",", "."));
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return compareUkrainian(left, right);
  });
}
