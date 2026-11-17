export type QualityTier = 'HIGH' | 'BALANCED' | 'MASS_BATTLE';
export type RenderLod = 'FULL' | 'SPRITE_SWARM' | 'ULTRA_SWARM';

export interface PerformanceBudget {
  tier: QualityTier;
  renderLod: RenderLod;
  maxParticles: number;
  maxLandProjectiles: number;
  maxCannonballs: number;
  maxFloatingTexts: number;
  aiScanIntervalMs: number;
  sepStride: number;
  maxSepNeighbors: number;
  dprCap: number;
  wakeSpawnScale: number;
  skipDamageFloatingTexts: boolean;
}

const BUDGETS: Record<QualityTier, PerformanceBudget> = {
  HIGH: {
    tier: 'HIGH',
    renderLod: 'FULL',
    maxParticles: 420,
    maxLandProjectiles: 400,
    maxCannonballs: 260,
    maxFloatingTexts: 24,
    aiScanIntervalMs: 120,
    sepStride: 1,
    maxSepNeighbors: 8,
    dprCap: 2.0,
    wakeSpawnScale: 1.0,
    skipDamageFloatingTexts: false,
  },
  BALANCED: {
    tier: 'BALANCED',
    renderLod: 'SPRITE_SWARM',
    maxParticles: 200,
    maxLandProjectiles: 240,
    maxCannonballs: 160,
    maxFloatingTexts: 12,
    aiScanIntervalMs: 220,
    sepStride: 2,
    maxSepNeighbors: 5,
    dprCap: 1.5,
    wakeSpawnScale: 0.55,
    skipDamageFloatingTexts: false,
  },
  MASS_BATTLE: {
    tier: 'MASS_BATTLE',
    renderLod: 'ULTRA_SWARM',
    maxParticles: 90,
    maxLandProjectiles: 140,
    maxCannonballs: 100,
    maxFloatingTexts: 7,
    aiScanIntervalMs: 340,
    sepStride: 3,
    maxSepNeighbors: 3,
    dprCap: 1.2,
    wakeSpawnScale: 0.25,
    skipDamageFloatingTexts: true,
  },
};

export class PerformanceGovernor {
  private emaFrameMs = 16.6;
  private tier: QualityTier = 'HIGH';
  private lastTierChangeAt = 0;

  public update(rawDeltaMs: number, activeUnitCount: number, nowMs: number): PerformanceBudget {
    // Ignore huge pauses (tab backgrounded / modal pause) so EMA isn't poisoned
    const clampedMs = rawDeltaMs > 0 && rawDeltaMs < 120 ? rawDeltaMs : 16.6;
    this.emaFrameMs = this.emaFrameMs * 0.9 + clampedMs * 0.1;

    // Hysteresis + 900ms cooldown prevents rapid LOD flickering
    if (nowMs - this.lastTierChangeAt >= 900) {
      let desired: QualityTier = this.tier;

      if (this.tier === 'HIGH') {
        if (activeUnitCount >= 230 || this.emaFrameMs >= 28) {
          desired = 'MASS_BATTLE';
        } else if (activeUnitCount >= 95 || this.emaFrameMs >= 20.5) {
          desired = 'BALANCED';
        }
      } else if (this.tier === 'BALANCED') {
        if (activeUnitCount >= 240 || this.emaFrameMs >= 28.5) {
          desired = 'MASS_BATTLE';
        } else if (activeUnitCount < 65 && this.emaFrameMs < 17.5) {
          desired = 'HIGH';
        }
      } else {
        // MASS_BATTLE
        if (activeUnitCount < 165 && this.emaFrameMs < 21.5) {
          desired = activeUnitCount < 65 && this.emaFrameMs < 17.5 ? 'HIGH' : 'BALANCED';
        }
      }

      if (desired !== this.tier) {
        this.tier = desired;
        this.lastTierChangeAt = nowMs;
      }
    }

    return BUDGETS[this.tier];
  }

  public getCurrentBudget(): PerformanceBudget {
    return BUDGETS[this.tier];
  }

  public reset(): void {
    this.emaFrameMs = 16.6;
    this.tier = 'HIGH';
    this.lastTierChangeAt = 0;
  }
}
