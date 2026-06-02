// Count rows by a field, such as status or source_key.
export function countBy(rows: Record<string, string>[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const key = row[field]?.trim() || "(blank)";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

// Make count output easy to scan in the terminal.
export function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, count]) => `${key}: ${count}`).join(", ");
}

