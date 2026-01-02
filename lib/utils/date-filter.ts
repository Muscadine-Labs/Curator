/**
 * Filter chart data to exclude dates before June 1, 2025
 * Only show data from June 1, 2025 onwards
 */
const CUTOFF_DATE = new Date('2025-06-01');

export function filterDataByDate<T extends { date: string }>(
  data: T[]
): T[] {
  if (!data || data.length === 0) {
    return data;
  }
  
  return data.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= CUTOFF_DATE;
  });
}

