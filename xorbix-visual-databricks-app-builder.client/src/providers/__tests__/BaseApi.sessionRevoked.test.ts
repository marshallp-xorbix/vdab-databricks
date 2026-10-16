import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseApi, type SessionInvalidatedReason } from "../../providers/BaseApi";
import { sessionEvents } from "../../lib/sessionEvents";

class TestApi extends BaseApi {
  constructor(baseUrl: string) {
    super(baseUrl);
  }

  async fetchProtected(endpoint: string): Promise<Response> {
    return this.fetchWithAuth(endpoint);
  }

  setAccessToken(token: string) {
    this.setTokens(token, "refresh-token");
  }
}

describe("BaseApi session revocation", () => {
  const originalFetch = global.fetch;
  let api: TestApi;
  let invalidatedReason: SessionInvalidatedReason | null;
  let unsubscribe: (() => void) | null;

  beforeEach(() => {
    api = new TestApi("https://api.test");
    invalidatedReason = null;
    unsubscribe = sessionEvents.subscribe((reason) => {
      invalidatedReason = reason;
    });
    api.setAccessToken("access-token");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    unsubscribe?.();
    unsubscribe = null;
    api.clearLocalTokens();
  });

  it("invalidates session on 401 with Vdab-Session-Revoked without attempting refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 401,
        headers: { "Vdab-Session-Revoked": "true" },
      }),
    );

    const response = await api.fetchProtected("/api/User/me");

    expect(response.status).toBe(401);
    expect(invalidatedReason).toBe("revoked");
    expect(api.getToken()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("invalidates session when refresh fails after token expiry", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: { "Vdab-Token-Expired": "true" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const response = await api.fetchProtected("/api/User/me");

    expect(response.status).toBe(401);
    expect(invalidatedReason).toBe("expired");
    expect(api.getToken()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not emit when access token is already cleared", async () => {
    api.clearLocalTokens();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 401,
        headers: { "Vdab-Session-Revoked": "true" },
      }),
    );

    const response = await api.fetchProtected("/api/Identity/logout/all");

    expect(response.status).toBe(401);
    expect(invalidatedReason).toBeNull();
    expect(api.getToken()).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
