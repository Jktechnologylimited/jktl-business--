/** Short, readable ids for mock data, e.g. id("cus") -> "cus_k3f8a1". */
export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
