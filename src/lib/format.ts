export function formatCount(n: number): string {
  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(n);
}