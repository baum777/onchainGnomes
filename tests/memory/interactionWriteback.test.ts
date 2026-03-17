/**
 * Interaction Writeback Tests — Fire-and-forget, affinity update
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  writeInteractionWriteback,
  type InteractionWritebackParams,
} from "../../src/memory/writeback/interactionWriteback.js";
import {
  getUserAffinityStore,
  resetUserAffinityStore,
  type UserGnomeAffinity,
} from "../../src/memory/userAffinityStore.js";

describe("Interaction Writeback", () => {
  beforeEach(() => {
    resetUserAffinityStore();
  });

  it("updates user-gnome affinity after writeback", async () => {
    const params: InteractionWritebackParams = {
      event_id: "ev_1",
      user_id: "user123",
      user_handle: "testuser",
      selected_gnome_id: "gorky",
      response_mode: "social_banter",
      intent: "greeting",
      reply_text: "Hello there!",
      safety_passed: true,
      published: true,
    };

    await writeInteractionWriteback(params);

    const store = getUserAffinityStore();
    const affinity = await store.getAffinity("user123", "gorky");
    expect(affinity).toBeDefined();
    expect(affinity?.interaction_count).toBe(1);
    expect(affinity?.familiarity).toBeGreaterThan(0);
  });

  it("does not throw on error (fire-and-forget)", async () => {
    await expect(
      writeInteractionWriteback({
        event_id: "ev_2",
        user_id: "",
        user_handle: "",
        selected_gnome_id: "gorky",
        response_mode: "single_tweet",
        intent: "unknown",
        reply_text: "",
        safety_passed: false,
        published: false,
      }),
    ).resolves.toBeUndefined();
  });
});
