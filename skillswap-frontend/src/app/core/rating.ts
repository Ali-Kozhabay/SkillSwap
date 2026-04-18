export function renderStars(rating: number): string {
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
}
