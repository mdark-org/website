export function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size))
}


const MAX_PARAMETERS = 90

export function chunkD1Columns<T>(items: T[], columns: number): T[][] {
  return chunk(items, Math.floor(MAX_PARAMETERS / columns))
}