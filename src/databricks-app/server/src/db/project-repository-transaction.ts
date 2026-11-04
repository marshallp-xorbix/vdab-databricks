/** Rolls back while preserving the original repository failure. */
export async function rollbackProjectTransaction(client: {
  query(text: string): Promise<unknown>;
}): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original repository error when PostgreSQL has ended the transaction.
  }
}
