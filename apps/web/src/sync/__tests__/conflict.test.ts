import { describe, expect, it, vi } from "vitest";

import type { FarmDotsDatabase } from "@/db/types";

import { applyPullDoc, mergeFields } from "../conflict";

describe("mergeFields (operations / events)", () => {
  it("advances status along planned → in_progress → completed", () => {
    const local = { status: "planned", title: "A", updatedAt: 1, version: 1 };
    const remote = { status: "completed", title: "A", updatedAt: 2, version: 1 };
    const m = mergeFields(local, remote);
    expect(m.status).toBe("completed");
  });

  it("does not downgrade a completed local status from a stale remote planned", () => {
    const local = { status: "completed", updatedAt: 5 };
    const remote = { status: "planned", updatedAt: 3 };
    expect(mergeFields(local, remote).status).toBe("completed");
  });

  it("fills null / missing local fields from remote", () => {
    const local = { notes: null, x: 1 };
    const remote = { notes: "hello", x: 2 };
    const m = mergeFields(local, remote);
    expect(m.notes).toBe("hello");
    expect(m.x).toBe(2);
  });
});

describe("applyPullDoc", () => {
  it("hard-deletes local doc when remote is a tombstone", async () => {
    const remove = vi.fn();
    const mockDb = {
      farm_events: {
        findOne: () => ({
          exec: async () => ({
            toJSON: () => ({ id: "e1", lastSyncedAt: 0, updatedAt: 10 }),
            remove,
          }),
        }),
        upsert: vi.fn(),
      },
      pending_conflicts: { insert: vi.fn() },
    };
    await applyPullDoc(mockDb as unknown as FarmDotsDatabase, "farm_events", {
      id: "e1",
      deletedAt: 999,
      updatedAt: 20,
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("inserts remote doc when no local copy exists", async () => {
    const upsert = vi.fn();
    const mockDb = {
      rows: {
        findOne: () => ({
          exec: async () => null,
        }),
        upsert,
      },
      pending_conflicts: { insert: vi.fn() },
    };
    await applyPullDoc(mockDb as unknown as FarmDotsDatabase, "rows", {
      id: "r1",
      farmId: "f1",
      updatedAt: 40,
      version: 1,
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    const doc = upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(doc.id).toBe("r1");
    expect(typeof doc.lastSyncedAt).toBe("number");
  });
});
