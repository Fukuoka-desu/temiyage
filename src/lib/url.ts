import { defaults, likeTags, type Conditions } from './score';
export function readConditions(prefs: string[], genres: string[]): Conditions {
  const p = new URLSearchParams(location.search);
  const c: Conditions = { ...defaults, likes: [...defaults.likes] };
  for (const key of ['pref', 'mine', 'fpref'] as const) {
    const v = p.get(key);
    if (v !== null && (prefs.includes(v) || (key !== 'pref' && v === ''))) c[key] = v;
  }
  for (const [key, values] of Object.entries({
    home: ['avoid', 'nostalgic'],
    budget: ['b1', 'b2', 'b3', 'b4'],
    use: ['first', 'apology', 'thanks', 'office', 'celebrate'],
    sort: ['recommend', 'low', 'high', 'days'],
    genre: ['', ...genres],
  })) {
    const v = p.get(key);
    if (v !== null && values.includes(v)) Object.assign(c, { [key]: v });
  }
  for (const key of ['nosweet', 'keep'] as const) c[key] = p.get(key) === '1';
  if (p.has('likes')) {
    const values = p.get('likes')!.split(',').filter(Boolean);
    if (values.every((v) => Object.hasOwnProperty.call(likeTags, v)))
      c.likes = [...new Set(values)];
  }
  c.q = p.get('q') ?? '';
  return c;
}
export function writeConditions(c: Conditions) {
  const p = new URLSearchParams();
  for (const key of Object.keys(c) as (keyof Conditions)[]) {
    const value = c[key];
    if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
    p.set(
      key,
      Array.isArray(value)
        ? value.join(',')
        : typeof value === 'boolean'
          ? value
            ? '1'
            : '0'
          : value,
    );
  }
  const query = p.toString();
  history.replaceState(null, '', `${location.pathname}${query ? '?' + query : ''}${location.hash}`);
}
