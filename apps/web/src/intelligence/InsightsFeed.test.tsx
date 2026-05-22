/** @vitest-environment jsdom */

import { AUTH_TOKEN_KEY } from "@/auth/authClient";
import { InsightsFeed } from "@/intelligence/InsightsFeed";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubLocalStorage() {
  const bag = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (bag.has(k) ? bag.get(k)! : null),
    setItem: (k: string, v: string) => {
      bag.set(k, v);
    },
    removeItem: (k: string) => {
      bag.delete(k);
    },
    clear: () => {
      bag.clear();
    },
    key: () => null,
    get length() {
      return bag.size;
    },
  });
}

describe("InsightsFeed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    stubLocalStorage();
    localStorage.setItem(AUTH_TOKEN_KEY, "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              insights: [
                {
                  id: "ins-1",
                  summary: "Sample irrigation insight",
                  type: "irrigation_gap",
                  generatedAt: Date.now(),
                },
              ],
            }),
        }),
      ),
    );
  });

  it("renders insights returned by the API", async () => {
    render(<InsightsFeed db={{} as never} farmId="farm-a" />);
    await waitFor(() => {
      expect(screen.queryByText("Sample irrigation insight")).toBeTruthy();
    });
  });
});
