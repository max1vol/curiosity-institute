export function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function pickWeightedItem<T>(entries: Array<{ item: T; weight: number }>): T {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (totalWeight <= 0) {
    return entries[0].item;
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= Math.max(0, entry.weight);

    if (remaining <= 0) {
      return entry.item;
    }
  }

  return entries[entries.length - 1].item;
}

export function pushRecentId(recentIds: string[], id: string, limit: number): string[] {
  return [...recentIds.filter((entry) => entry !== id), id].slice(-limit);
}

export function pickFreshDeckItem<T extends { id: string }>(
  items: T[],
  recentIds: string[],
  getWeight: (item: T) => number = () => 1,
): T {
  const recent = new Set(recentIds);
  const freshItems = items.filter((item) => !recent.has(item.id));
  const pool = freshItems.length ? freshItems : items;

  return pickWeightedItem(
    pool.map((item) => ({
      item,
      weight: getWeight(item),
    })),
  );
}
