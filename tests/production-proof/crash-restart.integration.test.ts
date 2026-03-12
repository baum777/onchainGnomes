/**
 * Crash/restart fault-injection tests.
 *
 * Verifies: state survives cache reset (simulated restart), no lost/corrupt state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordMentionSkipped,
  recordEventSeen,
  recordEventProcessed,
  publishWithRetry,
  isProcessed,
  isPublished,
  resetEventStates,
} from "../../src/state/eventStateStore.js";
import { getStateStore, resetStoreCache } from "../../src/state/storeFactory.js";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

describe("production-proof: crash/restart fault injection", () => {
  let tempDir: string;

  beforeEach(() => {
    process.env.USE_REDIS = "false";
    tempDir = mkdtempSync(path.join(tmpdir(), "crash-restart-"));
    process.env.DATA_DIR = tempDir;
    resetStoreCache();
  });

  afterEach(async () => {
    await resetEventStates();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("processed state survives cache reset (simulated restart)", async () => {
    const eventId = `crash_${Date.now()}`;
    await recordMentionSkipped(eventId);

    expect(await isProcessed(eventId)).toBe(true);

    await resetEventStates();

    expect(await isProcessed(eventId)).toBe(true);
  });

  it("published state survives cache reset and prevents republish", async () => {
    const eventId = `crash_pub_${Date.now()}`;
    const publishFn = vi.fn().mockResolvedValue({ tweetId: "t_crash_1" });

    await publishWithRetry(eventId, publishFn);
    expect(publishFn).toHaveBeenCalledTimes(1);

    await resetEventStates();

    const again = await publishWithRetry(eventId, publishFn);
    expect(again.success).toBe(true);
    expect(again.tweetId).toBe("t_crash_1");
    expect(publishFn).toHaveBeenCalledTimes(1);
  });

  it("after crash mid-publish, store state is consistent", async () => {
    const eventId = `crash_mid_${Date.now()}`;
    await recordEventSeen(eventId);
    await recordEventProcessed(eventId);

    await resetEventStates();

    const processed = await isProcessed(eventId);
    const published = await isPublished(eventId);

    expect(processed).toBe(true);
    expect(published.published).toBe(false);
  });

  it("claim → crash (no release) → TTL expiry → takeover: Worker B acquires after A died", async () => {
    const store = getStateStore();
    const lockKey = "worker:poll_lock";
    const holderA = "host-a:11111";
    const holderB = "host-b:22222";
    const ttlSeconds = 1;

    // Worker A claimt den Lock
    const aAcquired = await store.tryAcquireLeaderLock(lockKey, holderA, ttlSeconds);
    expect(aAcquired).toBe(true);

    // Worker B versucht zu übernehmen — noch innerhalb TTL → sollte fehlschlagen
    const bFail = await store.tryAcquireLeaderLock(lockKey, holderB, ttlSeconds);
    expect(bFail).toBe(false);

    // Simuliere Crash: A released den Lock nicht. Warte bis TTL abgelaufen ist.
    await new Promise((r) => setTimeout(r, 1500));

    // Worker B übernimmt nach TTL-Ablauf
    const bAcquired = await store.tryAcquireLeaderLock(lockKey, holderB, 120);
    expect(bAcquired).toBe(true);

    // Verifizieren: B hält den Lock, A kann nicht mehr freigeben (war nicht mehr Owner)
    const aReleaseOk = await store.releaseLeaderLock(lockKey, holderA);
    expect(aReleaseOk).toBe(false);

    // B kann korrekt freigeben
    const bReleaseOk = await store.releaseLeaderLock(lockKey, holderB);
    expect(bReleaseOk).toBe(true);
  });

  it("claim → crash → takeover: nach Takeover kein Doppelpublish", async () => {
    const store = getStateStore();
    const lockKey = "worker:poll_lock";
    const holderA = "host-a:33333";
    const holderB = "host-b:44444";

    // A claimt, "crasht" ohne Release
    await store.tryAcquireLeaderLock(lockKey, holderA, 1);
    await new Promise((r) => setTimeout(r, 1500));

    // B übernimmt
    const bAcquired = await store.tryAcquireLeaderLock(lockKey, holderB, 120);
    expect(bAcquired).toBe(true);

    // B verarbeitet ein Event und published — idempotent, kein Doppelpost
    const eventId = `crash_takeover_${Date.now()}`;
    const publishFn = vi.fn().mockResolvedValue({ tweetId: "t_takeover" });

    const result = await publishWithRetry(eventId, publishFn);
    expect(result.success).toBe(true);
    expect(publishFn).toHaveBeenCalledTimes(1);

    // Erneuter Aufruf → Duplikat verhindert
    const again = await publishWithRetry(eventId, publishFn);
    expect(again.success).toBe(true);
    expect(publishFn).toHaveBeenCalledTimes(1);

    await store.releaseLeaderLock(lockKey, holderB);
  });
});
