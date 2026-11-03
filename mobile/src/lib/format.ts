/** 999 -> "999", 1200 -> "1.2K", 124500 -> "124.5K", 1830000 -> "1.8M". Rounds down, like the big apps. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      const s = (Math.floor(v * 10) / 10).toString();
      return `${s}${suffix}`;
    }
  }
  return String(n);
}

/** "только что", "5 мин назад", "2 ч назад", "3 д назад", "4 нед назад". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} д назад`;
  return `${Math.floor(d / 7)} нед назад`;
}

/** Russian plural: plural(5, ['комментарий', 'комментария', 'комментариев']). */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
