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

export function getWorldCycleInfo(worldTimeSec: number): WorldCycleInfo {
  const safeT = Math.max(0, worldTimeSec);
  const totalDays = safeT / DAY_DURATION_SEC;
  const dayNumber = Math.floor(totalDays) + 1;
  const timeOfDay = totalDays - Math.floor(totalDays); // 0 = morning, 0.25 = noon, 0.5 = dusk, 0.75 = midnight

  const seasonIdx = Math.floor(Math.floor(totalDays) / DAYS_PER_SEASON) % SEASONS.length;
  const seasonSpec = SEASONS[seasonIdx];

  let period: DayPeriod = 'DAY';
  let periodLabel = 'Gündüz';
  let periodLabelEn = 'Day';
  let darknessAlpha = 0;
  let tintColor = 'rgba(7, 25, 36, 0)';

  if (timeOfDay < 0.14) {
    // Dawn: 0 -> 0.14
    const p = 1 - timeOfDay / 0.14;
    period = 'DAWN';
    periodLabel = 'Şafak';
    periodLabelEn = 'Dawn';
    darknessAlpha = p * 0.24;
    tintColor = `rgba(251, 146, 60, ${ (p * 0.12).toFixed(3) })`;
  } else if (timeOfDay < 0.54) {
    // Bright tropical day
    period = 'DAY';
    periodLabel = 'Gündüz';
    periodLabelEn = 'Day';
    darknessAlpha = 0;
    tintColor = 'rgba(0, 0, 0, 0)';
  } else if (timeOfDay < 0.68) {
    // Sunset / Dusk
    const p = (timeOfDay - 0.54) / 0.14;
    period = 'DUSK';
    periodLabel = 'Gün Batımı';
    periodLabelEn = 'Dusk';
    darknessAlpha = p * 0.34;
    tintColor = `rgba(180, 83, 9, ${ (Math.sin(p * Math.PI) * 0.16).toFixed(3) })`;
  } else if (timeOfDay < 0.9) {
    // Night
    period = 'NIGHT';
    periodLabel = 'Gece';
    periodLabelEn = 'Night';
    darknessAlpha = 0.4;
    tintColor = 'rgba(7, 20, 42, 0.42)';
  } else {
    // Pre-dawn transition
    const p = (timeOfDay - 0.9) / 0.1;
    period = 'DAWN';
    periodLabel = 'Alacakaranlık';
    periodLabelEn = 'Pre-Dawn';
    darknessAlpha = 0.4 - p * 0.16;
    tintColor = `rgba(15, 23, 42, ${ (darknessAlpha).toFixed(3) })`;
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
    else if (r < stormBias + 0.26) type = 'TREASURE_TIDE';
    else if (r < stormBias + 0.5) type = 'BOUNTY_CONVOY';
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
      title: 'Korsan Hazine Gemisi!',
      description: 'Yüksek ödüllü bir Hazine Kalyonu yakın sularda görüldü!',
      startedAt: nowMs,
      endsAt: nowMs + 50000,
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
