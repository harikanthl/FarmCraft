import { describe, expect, it } from "vitest";
import { PENDING_SYNC_OP_ID_MAX_LENGTH, SYNC_COLLECTIONS, pendingKey } from "@/sync/mutationGateway";

describe("pendingKey", () => {
  it("fits pending_sync_operations id maxLength for every sync collection + uuid doc id", () => {
    const docId = "000015a0-a062-4f7c-a8ed-c66e40baf53f";
    for (const collection of SYNC_COLLECTIONS) {
      const id = pendingKey(collection, docId);
      expect(id.length).toBeLessThanOrEqual(PENDING_SYNC_OP_ID_MAX_LENGTH);
      expect(id).toBe(`${collection}:${docId}`);
    }
  });
});
