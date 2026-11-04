/** Formats project update timestamps in the viewer's locale. */
export function formatUpdatedAt(value: string): string {
  const updatedAt = new Date(value);
  return Number.isNaN(updatedAt.getTime())
    ? "recently"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        updatedAt,
      );
}
