import { describe, expect, it } from "vitest";

import type { Env } from "../src/repo.js";
import { app } from "../src/index.js";

describe("sync HTTP", () => {
  it("GET /api/v1/sync/pull requires auth", async () => {
    const res = await app.request("http://local/api/v1/sync/pull?collection=farms");
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/sync/push requires auth", async () => {
    const res = await app.request("http://local/api/v1/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: "farms", ops: [] }),
    });
    expect(res.status).toBe(401);
  });

  it("pull returns x-d1-bookmark for dev auth when no farms (bookmark passthrough)", async () => {
    const sessionStub = {
      prepare() {
        return {
          bind() {
            return {
              all: async () => ({ results: [] }),
            };
          },
        };
      },
      getBookmark: () => "bookmark-test",
    };
    const env = {
      DB: {
        prepare(sql: string) {
          const stmt = {
            bind() {
              return {
                run: async () => {},
                first: async () => null,
                all: async () => ({ results: [] }),
              };
            },
            async all() {
              if (sql.includes("SELECT id FROM farms")) {
                return { results: [] };
              }
              return { results: [] };
            },
          };
          return stmt;
        },
        withSession: () => sessionStub,
      },
      ASSETS: {} as R2Bucket,
      AUTH_DEV_TOKEN: "test-token",
      AUTH_DEV_MODE: "true",
    } as Env;

    const res = await app.request(
      "http://local/api/v1/sync/pull?collection=farms&since=0",
      {
        headers: {
          Authorization: "Bearer test-token",
          "x-d1-bookmark": "first-unconstrained",
        },
      },
      env,
    );

    expect(res.headers.get("x-d1-bookmark")).toBe("bookmark-test");
    const body = (await res.json()) as { docs: unknown[]; nextCursor: number };
    expect(body.docs).toEqual([]);
    expect(body.nextCursor).toBe(0);
  });
});
