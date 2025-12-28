import { DurableObject } from "cloudflare:workers";
import type { DemoItem, UserProfile, MatchResult, MatchResponse, Tier } from '@shared/types';
import { MOCK_ITEMS } from '@shared/mock-data';
// Glicko-2 Constants
const TAU = 0.5;
const VOLATILITY_DEFAULT = 0.06;
const RATING_DEFAULT = 1200; // Starting MMR (Silver/Gold border)
const RD_DEFAULT = 350;
// **DO NOT MODIFY THE CLASS NAME**
export class GlobalDurableObject extends DurableObject {
    // --- Existing Demo Methods (Preserved) ---
    async getCounterValue(): Promise<number> {
      const value = (await this.ctx.storage.get("counter_value")) || 0;
      return value as number;
    }
    async increment(amount = 1): Promise<number> {
      let value: number = (await this.ctx.storage.get("counter_value")) || 0;
      value += amount;
      await this.ctx.storage.put("counter_value", value);
      return value;
    }
    async decrement(amount = 1): Promise<number> {
      let value: number = (await this.ctx.storage.get("counter_value")) || 0;
      value -= amount;
      await this.ctx.storage.put("counter_value", value);
      return value;
    }
    async getDemoItems(): Promise<DemoItem[]> {
      const items = await this.ctx.storage.get("demo_items");
      if (items) return items as DemoItem[];
      await this.ctx.storage.put("demo_items", MOCK_ITEMS);
      return MOCK_ITEMS;
    }
    async addDemoItem(item: DemoItem): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = [...items, item];
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    async updateDemoItem(id: string, updates: Partial<Omit<DemoItem, 'id'>>): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = items.map(item => item.id === id ? { ...item, ...updates } : item);
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    async deleteDemoItem(id: string): Promise<DemoItem[]> {
      const items = await this.getDemoItems();
      const updatedItems = items.filter(item => item.id !== id);
      await this.ctx.storage.put("demo_items", updatedItems);
      return updatedItems;
    }
    // --- New Ranked System Methods ---
    async getUserProfile(userId: string, username: string = 'Player'): Promise<UserProfile> {
      const key = `user_${userId}`;
      const profile = await this.ctx.storage.get<UserProfile>(key);
      if (profile) return profile;
      // Initialize new user
      const newProfile: UserProfile = {
        id: userId,
        username,
        rating: RATING_DEFAULT,
        rd: RD_DEFAULT,
        volatility: VOLATILITY_DEFAULT,
        wins: 0,
        losses: 0,
        tier: 'Silver',
        division: 3,
        lastMatchTime: Date.now()
      };
      await this.ctx.storage.put(key, newProfile);
      return newProfile;
    }
    async processMatch(match: MatchResult): Promise<MatchResponse> {
      const profile = await this.getUserProfile(match.userId);
      // Simplified Glicko-2 Calculation for 1v1 vs Bot/Opponent
      // 1. Determine Score (1 = Win, 0 = Loss, 0.5 = Draw)
      const s = match.result === 'win' ? 1 : match.result === 'loss' ? 0 : 0.5;
      // 2. Calculate Expected Score (E)
      // We assume opponent has standard RD for this calculation to simplify
      const qa = Math.log(10) / 400;
      const rdOpponent = 350; // Assume uncertain opponent for volatility
      const g_rd = 1 / Math.sqrt(1 + 3 * Math.pow(qa * rdOpponent / Math.PI, 2));
      const E = 1 / (1 + Math.pow(10, -g_rd * (profile.rating - match.opponentRating) / 400));
      // 3. Update Rating
      // K-factor equivalent logic (simplified for MVP)
      // High RD = High change. Low RD = Low change.
      const K = profile.rd / 10; // Dynamic K based on uncertainty
      const ratingChange = K * (s - E);
      const newRating = profile.rating + ratingChange;
      // 4. Update RD (Decrease uncertainty after playing)
      const newRD = Math.max(30, profile.rd * 0.95); // Decay RD
      // 5. Update Stats
      profile.rating = Math.round(newRating);
      profile.rd = newRD;
      if (match.result === 'win') profile.wins++;
      if (match.result === 'loss') profile.losses++;
      profile.lastMatchTime = Date.now();
      // 6. Calculate Tier
      const { tier, division } = this.calculateTier(profile.rating);
      profile.tier = tier;
      profile.division = division;
      // Save
      await this.ctx.storage.put(`user_${match.userId}`, profile);
      return {
        newRating: profile.rating,
        ratingChange: Math.round(ratingChange),
        newTier: tier,
        newDivision: division
      };
    }
    private calculateTier(rating: number): { tier: Tier, division: 1 | 2 | 3 } {
      if (rating < 900) return { tier: 'Bronze', division: rating < 300 ? 3 : rating < 600 ? 2 : 1 };
      if (rating < 1200) return { tier: 'Silver', division: rating < 1000 ? 3 : rating < 1100 ? 2 : 1 };
      if (rating < 1500) return { tier: 'Gold', division: rating < 1300 ? 3 : rating < 1400 ? 2 : 1 };
      if (rating < 1800) return { tier: 'Platinum', division: rating < 1600 ? 3 : rating < 1700 ? 2 : 1 };
      if (rating < 2100) return { tier: 'Diamond', division: rating < 1900 ? 3 : rating < 2000 ? 2 : 1 };
      return { tier: 'Master', division: 1 };
    }
}