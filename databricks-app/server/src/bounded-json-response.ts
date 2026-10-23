/** Maximum JSON payload accepted from a workspace API response. */
export const MAX_WORKSPACE_JSON_RESPONSE_BYTES = 1_048_576;

/** Reads JSON while enforcing a byte limit before parsing untrusted response data. */
export async function readBoundedJsonResponse(
  response: Response,
  maximumBytes: number,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("A positive safe JSON response limit is required.");
  }

  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maximumBytes
  ) {
    await discardHttpResponseBody(response);
    throw new Error("The JSON response exceeds its configured size limit.");
  }

  if (!response.body) {
    throw new Error("The JSON response body is missing.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      signal?.throwIfAborted();
      const result = await reader.read();
      if (result.done) break;

      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("The JSON response exceeds its configured size limit.");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const responseBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    responseBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const responseText = new TextDecoder("utf-8", { fatal: true }).decode(
    responseBytes,
  );
  return JSON.parse(responseText) as unknown;
}

/** Releases an upstream response body that the caller does not need to read. */
export async function discardHttpResponseBody(
  response: Response,
): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The request result is already determined; body cleanup must not replace it.
  }
}
