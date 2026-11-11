type Result<T> = { data: T[] | null; error: unknown };

/** Bound REST response sizes without silently losing rows at the API row limit. */
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<Result<T>>) {
  const rows: T[] = [];
  for (let from = 0; from < 100_000; from += 500) {
    const result = await read(from, from + 499);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new Error("This report exceeds 100,000 records. Narrow its scope before loading.");
}

/** Small IN filters avoid URL limits; four independent groups run at a time. */
export async function readByIds<T>(ids: string[], read: (ids: string[], from: number, to: number) => PromiseLike<Result<T>>) {
  const unique = [...new Set(ids)];
  const groups: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) groups.push(unique.slice(i, i + 100));
  const rows: T[] = [];
  for (let i = 0; i < groups.length; i += 4) {
    const results = await Promise.all(groups.slice(i, i + 4).map(group => readAllPages((from, to) => read(group, from, to))));
    results.forEach(result => rows.push(...result));
  }
  return rows;
}
