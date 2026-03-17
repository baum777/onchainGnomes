import { getStateStore } from "../state/storeFactory.js";

const PREFIX = "timeline:engagement";

export class EngagementMemory {
  private readonly store = getStateStore();

  async isTweetHandled(tweetId: string): Promise<boolean> {
    return this.store.exists(`${PREFIX}:tweet:${tweetId}`);
  }

  async isAuthorCoolingDown(authorId: string): Promise<boolean> {
    return this.store.exists(`${PREFIX}:author:${authorId}`);
  }

  async isConversationCoolingDown(conversationId: string): Promise<boolean> {
    return this.store.exists(`${PREFIX}:conversation:${conversationId}`);
  }

  async getHourlyCount(): Promise<number> {
    const value = await this.store.get(`${PREFIX}:count:hour`);
    return value ? Number(value) : 0;
  }

  async getDailyCount(): Promise<number> {
    const value = await this.store.get(`${PREFIX}:count:day`);
    return value ? Number(value) : 0;
  }

  async recordPublish(input: {
    tweetId: string;
    conversationId: string;
    authorId: string;
    authorCooldownMinutes: number;
    conversationCooldownMinutes: number;
  }): Promise<void> {
    await this.store.set(`${PREFIX}:tweet:${input.tweetId}`, "1", 60 * 60 * 24 * 7);
    await this.store.set(
      `${PREFIX}:author:${input.authorId}`,
      "1",
      input.authorCooldownMinutes * 60
    );
    await this.store.set(
      `${PREFIX}:conversation:${input.conversationId}`,
      "1",
      input.conversationCooldownMinutes * 60
    );

    const hourKey = `${PREFIX}:count:hour`;
    const dayKey = `${PREFIX}:count:day`;

    const hour = await this.store.incr(hourKey);
    if (hour === 1) await this.store.expire(hourKey, 60 * 60);

    const day = await this.store.incr(dayKey);
    if (day === 1) await this.store.expire(dayKey, 60 * 60 * 24);
  }
}
