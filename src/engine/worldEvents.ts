import { ActiveWorldEvent, SeasonId, WorldEventType } from '../types/game';

export type DayPeriod = 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';

export interface WorldCycleInfo {
  dayNumber: number;
  timeOfDay: number; // 0..1
  period: DayPeriod;
  periodLabel: string;
  periodLabelEn: string;
  darknessAlpha: number; // 0..0.44
  tintColor: string;
  season: SeasonId;
  seasonLabel: string;
  seasonLabelEn: string;
  treasureLuckBonus: number;
  enemyPowerMult: number;
  stormChanceMult: number;
}

const DAY_DURATION_SEC = 180; // 3 real minutes per full day/night cycle
const DAYS_PER_SEASON = 3;

const SEASONS: Array<{
  id: SeasonId;
  label: string;
  labelEn: string;
  treasureLuckBonus: number;
  enemyPowerMult: number;
  stormChanceMult: number;
}> = [
  {
    id: 'SPRING',
    label: 'İlkbahar',
    labelEn: 'Spring',
    treasureLuckBonus: 0.04,
    enemyPowerMult: 1.0,
    stormChanceMult: 1.0,
  },
  {
    id: 'SUMMER',
    label: 'Yaz',
    labelEn: 'Summer',
    treasureLuckBonus: 0.1,
    enemyPowerMult: 0.96,
    stormChanceMult: 0.75,
  },
  {
    id: 'AUTUMN',
    label: 'Sonbahar',
    labelEn: 'Autumn',
    treasureLuckBonus: 0.06,
    enemyPowerMult: 1.05,
    stormChanceMult: 1.25,
  },
  {
    id: 'WINTER',
    label: 'Kış',
    labelEn: 'Winter',
    treasureLuckBonus: 0.12,
    enemyPowerMult: 1.12,
    stormChanceMult: 1.5,
  },
];

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function lerpRgba(
  c1: [number, number, number, number],
  c2: [number, number, number, number],
  t: number
): string {
  const s = smoothstep(t);
  const r = Math.round(lerpNum(c1[0], c2[0], s));
  const g = Math.round(lerpNum(c1[1], c2[1], s));
  const b = Math.round(lerpNum(c1[2], c2[2], s));
  const a = lerpNum(c1[3], c2[3], s);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export function getWorldCycleInfo(worldTimeSec: number): WorldCycleInfo {
  const safeT = Math.max(0, worldTimeSec);
  const totalDays = safeT / DAY_DURATION_SEC;
  const dayNumber = Math.floor(totalDays) + 1;
  const timeOfDay = totalDays - Math.floor(totalDays); // 0..1: 0.0=sunrise, 0.25=noon, 0.62=sunset, 0.80=midnight

  const seasonIdx = Math.floor(Math.floor(totalDays) / DAYS_PER_SEASON) % SEASONS.length;
  const seasonSpec = SEASONS[seasonIdx];

  const nightColor: [number, number, number, number] = [7, 20, 44, 0.42];
  const dawnWarmColor: [number, number, number, number] = [217, 119, 54, 0.16];
  const duskAmberColor: [number, number, number, number] = [180, 83, 18, 0.22];
  const clearDayColor: [number, number, number, number] = [0, 0, 0, 0];

  let period: DayPeriod = 'DAY';
  let periodLabel = 'Gündüz';
  let periodLabelEn = 'Day';
  let darknessAlpha = 0;
  let tintColor = 'rgba(0, 0, 0, 0.000)';

  if (timeOfDay < 0.06) {
    // Late pre-dawn -> sunrise warm glow
    const p = timeOfDay / 0.06;
    period = 'DAWN';
    periodLabel = 'Şafak';
    periodLabelEn = 'Dawn';
    darknessAlpha = lerpNum(0.28, 0.14, smoothstep(p));
    tintColor = lerpRgba([16, 26, 52, 0.28], dawnWarmColor, p);
  } else if (timeOfDay < 0.14) {
    // Sunrise -> bright tropical day
    const p = (timeOfDay - 0.06) / 0.08;
    period = 'DAWN';
    periodLabel = 'Şafak';
    periodLabelEn = 'Dawn';
    darknessAlpha = lerpNum(0.14, 0, smoothstep(p));
    tintColor = lerpRgba(dawnWarmColor, clearDayColor, p);
  } else if (timeOfDay < 0.54) {
    // Bright tropical day
    period = 'DAY';
    periodLabel = 'Gündüz';
    periodLabelEn = 'Day';
    darknessAlpha = 0;
    tintColor = 'rgba(0, 0, 0, 0.000)';
  } else if (timeOfDay < 0.62) {
    // Afternoon -> warm golden sunset
    const p = (timeOfDay - 0.54) / 0.08;
    period = 'DUSK';
    periodLabel = 'Gün Batımı';
    periodLabelEn = 'Dusk';
    darknessAlpha = lerpNum(0, 0.22, smoothstep(p));
    tintColor = lerpRgba(clearDayColor, duskAmberColor, p);
  } else if (timeOfDay < 0.70) {
    // Sunset -> deep nightfall (no alpha dip!)
    const p = (timeOfDay - 0.62) / 0.08;
    period = 'DUSK';
    periodLabel = 'Akşamüstü';
    periodLabelEn = 'Twilight';
    darknessAlpha = lerpNum(0.22, 0.42, smoothstep(p));
    tintColor = lerpRgba(duskAmberColor, nightColor, p);
  } else if (timeOfDay < 0.90) {
    // Deep tropical night
    period = 'NIGHT';
    periodLabel = 'Gece';
    periodLabelEn = 'Night';
    darknessAlpha = 0.42;
    tintColor = 'rgba(7, 20, 44, 0.420)';
  } else {
    // Night -> pre-dawn indigo
    const p = (timeOfDay - 0.90) / 0.10;
    period = 'DAWN';
    periodLabel = 'Alacakaranlık';
    periodLabelEn = 'Pre-Dawn';
    darknessAlpha = lerpNum(0.42, 0.28, smoothstep(p));
    tintColor = lerpRgba(nightColor, [16, 26, 52, 0.28], p);
  }

  return {
    dayNumber,
    timeOfDay,
    period,
    periodLabel,
    periodLabelEn,
    darknessAlpha,
    tintColor,
    season: seasonSpec.id,
    seasonLabel: seasonSpec.label,
    seasonLabelEn: seasonSpec.labelEn,
    treasureLuckBonus: seasonSpec.treasureLuckBonus,
    enemyPowerMult: seasonSpec.enemyPowerMult,
    stormChanceMult: seasonSpec.stormChanceMult,
  };
}

export function createWorldEvent(
  season: SeasonId,
  nowMs: number,
  forceType?: WorldEventType
): ActiveWorldEvent {
  const stormBias = season === 'WINTER' || season === 'AUTUMN' ? 0.42 : 0.25;
  const r = Math.random();
  let type: WorldEventType = forceType ?? 'TREASURE_TIDE';
  if (!forceType) {
    if (r < stormBias) type = 'STORM';
    else if (r < stormBias + 0.22) type = 'TREASURE_TIDE';
    else if (r < stormBias + 0.42) type = 'BOUNTY_CONVOY';
    else if (r < stormBias + 0.58) type = 'CASTAWAY_RESCUE';
    else type = 'FOG';
  }

  if (type === 'STORM') {
    return {
      type,
      title: 'Açık Deniz Fırtınası!',
      description: 'Rüzgar gülleleri saptırır; batırılan gemiler +%50 ekstra altın verir.',
      startedAt: nowMs,
      endsAt: nowMs + 42000,
    };
  }
  if (type === 'TREASURE_TIDE') {
    return {
      type,
      title: 'Altın Akıntısı!',
      description: 'Yakın sularda yüzen ganimet sandıkları ve nadir hazine şansı arttı.',
      startedAt: nowMs,
      endsAt: nowMs + 45000,
    };
  }
  if (type === 'BOUNTY_CONVOY') {
    return {
      type,
      title: 'Korsan Hazine Konvoyu!',
      description: 'Refakatçi gemilerle korunan yüksek ödüllü bir Hazine Kalyonu görüldü!',
      startedAt: nowMs,
      endsAt: nowMs + 50000,
    };
  }
  if (type === 'CASTAWAY_RESCUE') {
    return {
      type,
      title: 'Kazazede & Hazine Haritası!',
      description: 'Yakın sularda şişe haritalar ve sürüklenen kazazede salları belirdi; toplayarak ada keşfet!',
      startedAt: nowMs,
      endsAt: nowMs + 46000,
    };
  }
  return {
    type: 'FOG',
    title: 'Gizemli Tropik Sis',
    description: 'Yoğun sis altında antik kalıntı bulma şansı 2 katına çıktı.',
    startedAt: nowMs,
    endsAt: nowMs + 40000,
  };
}
