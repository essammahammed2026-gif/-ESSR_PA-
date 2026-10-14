export const toUnit = (mm: number, unit: string) => {
  if (unit === "cm") return +(mm / 10).toFixed(2);
  if (unit === "in") return +(mm / 25.4).toFixed(3);
  return +mm.toFixed(2);
};

export const toMm = (val: number, unit: string) => {
  if (unit === "cm") return val * 10;
  if (unit === "in") return val * 25.4;
  return val;
};
