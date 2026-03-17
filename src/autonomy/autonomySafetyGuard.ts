/**
 * Autonomy Safety Guard — Prevent runaway swarm/autonomy
 *
 * Phase-4: Enforce reply frequency limits, anti-spam.
 */

const MAX_SWARM_PER_HOUR = 4;
const MAX_CAMEOS_PER_REPLY = 2;

const recentSwarmByUser = new Map<string, { count: number; resetAt: number }>();

function getWindowKey(userId: string): { count: number; resetAt: number } {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const entry = recentSwarmByUser.get(userId);
  if (!entry || now > entry.resetAt) {
    const newEntry = { count: 0, resetAt: now + hour };
    recentSwarmByUser.set(userId, newEntry);
    return newEntry;
  }
  return entry;
}

/** Check if swarm reply is safe (not spammy). */
export function isSwarmSafe(
  userId: string,
  cameoCount: number,
): { safe: boolean; reason?: string } {
  if (cameoCount > MAX_CAMEOS_PER_REPLY)
    return { safe: false, reason: "too_many_cameos" };
  const win = getWindowKey(userId);
  if (win.count >= MAX_SWARM_PER_HOUR)
    return { safe: false, reason: "swarm_limit_exceeded" };
  return { safe: true };
}

/** Record swarm usage for rate limiting. */
export function recordSwarmUsage(userId: string): void {
  const win = getWindowKey(userId);
  win.count++;
}
