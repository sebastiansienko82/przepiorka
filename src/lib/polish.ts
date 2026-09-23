export function photoCount(count: number): string {
  if (count === 1) return "1 zdjęcie";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} zdjęcia`;
  return `${count} zdjęć`;
}
