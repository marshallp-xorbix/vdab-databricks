/** Formats project update timestamps as Today, Yesterday, or a short date. */
export function formatUpdatedAt(value: string): string {
  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) return "recently";
  const now = new Date();
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(updatedAt);
  if (isSameDay(updatedAt, now)) return `Today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(updatedAt, yesterday)) return `Yesterday at ${time}`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(updatedAt);
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}
