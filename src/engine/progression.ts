export interface RelicDef {
  id: string;
  setId: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  color: string;
}

export interface RelicSetDef {
  id: string;
  name: string;
  nameEn: string;
  bonusLabel: string;
  bonusLabelEn: string;
  relicIds: string[];
}

export const RELIC_DEFS: RelicDef[] = [
  // Set 1: Royal Navy
  {
    id: 'relic_sextant',
    setId: 'ROYAL_NAVY',
    name: 'Altın Sekstant',
    nameEn: 'Golden Sextant',
    description: 'Yıldızlara bakarak rota çizen kraliyet seyir aleti.',
    descriptionEn: 'Royal navigation instrument for charting stars.',
    color: '#38BDF8',
  },
  {
    id: 'relic_spyglass',
    setId: 'ROYAL_NAVY',
    name: 'Amiral Dürbünü',
    nameEn: "Admiral's Spyglass",
    description: 'Ufuktaki filoları kilometrelerce öteden seçer.',
    descriptionEn: 'Spots distant fleets across the horizon.',
    color: '#0EA5E9',
  },
  {
    id: 'relic_compass',
    setId: 'ROYAL_NAVY',
    name: 'Kraliyet Pusulası',
    nameEn: 'Royal Compass',
    description: 'Fırtınada bile şaşmayan manyetik iğne.',
    descriptionEn: 'Steadfast magnetic needle even in fierce storms.',
    color: '#7DD3FC',
  },

  // Set 2: Sun Clan Relics
  {
    id: 'relic_sundisk',
    setId: 'SUN_RELICS',
    name: 'Altın Güneş Diski',
    nameEn: 'Golden Sun Disk',
    description: 'Antik Güneş Tapınağı’ndan kalma parlak mühür.',
    descriptionEn: 'Radiant seal from the ancient Sun Temple.',
    color: '#FBBF24',
  },
  {
    id: 'relic_jademask',
    setId: 'SUN_RELICS',
    name: 'Yeşim Maske',
    nameEn: 'Jade Mask',
    description: 'Zümrüt oymalı törensel ada muhafızı maskesi.',
    descriptionEn: 'Ceremonial island guardian mask carved in jade.',
    color: '#10B981',
  },
  {
    id: 'relic_chalice',
    setId: 'SUN_RELICS',
    name: 'Antik Güneş Kadehi',
    nameEn: 'Ancient Sun Chalice',
    description: 'Saf altın ve yakutlarla işlenmiş kutsal kadeh.',
    descriptionEn: 'Sacred chalice inlaid with pure gold and rubies.',
    color: '#F59E0B',
  },

  // Set 3: Corsair Heirlooms
  {
    id: 'relic_ring',
    setId: 'CORSAIR_HEIRLOOMS',
    name: 'Karasakal Yüzüğü',
    nameEn: "Blackbeard's Ring",
    description: 'Efsanevi korsan kaptanının mühür yüzüğü.',
    descriptionEn: 'Signet ring of a legendary pirate captain.',
    color: '#EF4444',
  },
  {
    id: 'relic_bandana',
    setId: 'CORSAIR_HEIRLOOMS',
    name: 'Kızıl İpek Bandana',
    nameEn: 'Crimson Silk Bandana',
    description: 'Sayısız deniz muharebesinden sağ çıkmış tılsım.',
    descriptionEn: 'Talisman that survived countless sea battles.',
    color: '#F43F5E',
  },
  {
    id: 'relic_anchor',
    setId: 'CORSAIR_HEIRLOOMS',
    name: 'Gümüş Çıpa',
    nameEn: 'Silver Anchor',
    description: 'Korsan kardeşliğinin gümüş arması.',
    descriptionEn: 'Silver emblem of the corsair brotherhood.',
    color: '#CBD5E1',
  },

  // Set 4: Deep Ocean
  {
    id: 'relic_pearl',
    setId: 'DEEP_SEA',
    name: 'İnci Deniz Kabuğu',
    nameEn: 'Pearl Conch Shell',
    description: 'Derin lagünlerin yankısını taşıyan nadir kabuk.',
    descriptionEn: 'Rare shell carrying echoes of deep lagoons.',
    color: '#A855F7',
  },
  {
    id: 'relic_obsidian',
    setId: 'DEEP_SEA',
    name: 'Volkanik Obsidyen Taşı',
    nameEn: 'Volcanic Obsidian Shard',
    description: 'Sönmüş kraterlerin dibinden çıkarılan kara kristal.',
    descriptionEn: 'Dark crystal forged at the bottom of extinct craters.',
    color: '#C084FC',
  },
  {
    id: 'relic_medallion',
    setId: 'DEEP_SEA',
    name: 'Denizkızı Madalyonu',
    nameEn: 'Siren Medallion',
    description: 'Kaptanlara okyanusun sırlarını fısıldayan kolye.',
    descriptionEn: 'Pendant whispering secrets of the deep ocean.',
    color: '#22D3EE',
  },
];

export const RELIC_SETS: RelicSetDef[] = [
  {
    id: 'ROYAL_NAVY',
    name: 'Kraliyet Denizcilik Seti',
    nameEn: 'Royal Navy Set',
    bonusLabel: '+%15 Gemi Hızı & +%15 Top Hasarı',
    bonusLabelEn: '+15% Ship Speed & +15% Cannon Damage',
    relicIds: ['relic_sextant', 'relic_spyglass', 'relic_compass'],
  },
  {
    id: 'SUN_RELICS',
    name: 'Antik Güneş Kalıntıları',
    nameEn: 'Ancient Sun Relics',
    bonusLabel: '+%20 Hazine Satış Değeri',
    bonusLabelEn: '+20% Treasure Sell Value',
    relicIds: ['relic_sundisk', 'relic_jademask', 'relic_chalice'],
  },
  {
    id: 'CORSAIR_HEIRLOOMS',
    name: 'Korsan Kaptan Yadigarları',
    nameEn: 'Corsair Heirlooms',
    bonusLabel: '+25 Maksimum Kaptan Canı & Hızlı İyileşme',
    bonusLabelEn: '+25 Max Captain HP & Faster Regen',
    relicIds: ['relic_ring', 'relic_bandana', 'relic_anchor'],
  },
  {
    id: 'DEEP_SEA',
    name: 'Derin Okyanus Hazineleri',
    nameEn: 'Deep Ocean Treasures',
    bonusLabel: '-%20 Radar/Yetenek Süresi & +%12 Zırh',
    bonusLabelEn: '-20% Radar/Ability Cooldown & +12% Armor',
    relicIds: ['relic_pearl', 'relic_obsidian', 'relic_medallion'],
  },
];

export interface RelicSetBonuses {
  shipSpeedMult: number;
  cannonDmgMult: number;
  treasureValueMult: number;
  extraPlayerMaxHp: number;
  regenMult: number;
  cooldownMult: number;
  extraArmorReduction: number;
  completedSets: string[];
}

export function getRelicSetBonuses(collectedRelicIds: string[]): RelicSetBonuses {
  const owned = new Set(collectedRelicIds);
  const completedSets: string[] = [];

  for (const set of RELIC_SETS) {
    if (set.relicIds.every((id) => owned.has(id))) {
      completedSets.push(set.id);
    }
  }

  return {
    shipSpeedMult: completedSets.includes('ROYAL_NAVY') ? 1.15 : 1,
    cannonDmgMult: completedSets.includes('ROYAL_NAVY') ? 1.15 : 1,
    treasureValueMult: completedSets.includes('SUN_RELICS') ? 1.2 : 1,
    extraPlayerMaxHp: completedSets.includes('CORSAIR_HEIRLOOMS') ? 25 : 0,
    regenMult: completedSets.includes('CORSAIR_HEIRLOOMS') ? 1.8 : 1,
    cooldownMult: completedSets.includes('DEEP_SEA') ? 0.8 : 1,
    extraArmorReduction: completedSets.includes('DEEP_SEA') ? 0.12 : 0,
    completedSets,
  };
}

export interface CampaignStatsInput {
  treasuresFoundCount: number;
  enemiesSunkCount: number;
  landEnemiesDefeated: number;
  discoveredIslandsCount: number;
  conqueredIslandsCount: number;
  kingdomFounded: boolean;
  boatLevel: number;
  collectedRelicsCount: number;
  totalGoldEarned: number;
  stormsSurvivedCount: number;
  soldiersCount: number;
  escortShipCount: number;
}

export interface CampaignMilestoneDef {
  id: string;
  chapter: number;
  title: string;
  titleEn: string;
  story: string;
  storyEn: string;
  rewardGold: number;
  isComplete: (s: CampaignStatsInput) => boolean;
  progressText: (s: CampaignStatsInput) => string;
}

export const CAMPAIGN_MILESTONES: CampaignMilestoneDef[] = [
  {
    id: 'ms_1_first_treasure',
    chapter: 1,
    title: 'İlk Gömü',
    titleEn: 'First Buried Chest',
    story: 'Başlangıç Limanı kumlarının altında eski bir haritanın ilk işareti ortaya çıktı.',
    storyEn: 'Under the sands of Starter Harbor, the first clue of an ancient chart appeared.',
    rewardGold: 75,
    isComplete: (s) => s.treasuresFoundCount >= 1,
    progressText: (s) => `${Math.min(1, s.treasuresFoundCount)}/1`,
  },
  {
    id: 'ms_2_explorer',
    chapter: 2,
    title: 'Ufukların Ötesi',
    titleEn: 'Beyond the Horizon',
    story: 'Komşu adalara yelken açarak takımadaların haritasını çizmeye başladın.',
    storyEn: 'You set sail to neighboring islands and began charting the archipelago.',
    rewardGold: 120,
    isComplete: (s) => s.discoveredIslandsCount >= 4,
    progressText: (s) => `${Math.min(4, s.discoveredIslandsCount)}/4`,
  },
  {
    id: 'ms_3_sea_hunter',
    chapter: 3,
    title: 'Denizlerin Kılıcı',
    titleEn: 'Scourge of the Seas',
    story: 'Korsan ve rakip devriye gemileri adını duyduğunda rotalarını değiştirmeye başladı.',
    storyEn: 'Pirate and rival patrol vessels now steer clear at the mention of your name.',
    rewardGold: 180,
    isComplete: (s) => s.enemiesSunkCount >= 5,
    progressText: (s) => `${Math.min(5, s.enemiesSunkCount)}/5`,
  },
  {
    id: 'ms_4_kingdom',
    chapter: 4,
    title: 'Yeni Devletin Doğuşu',
    titleEn: 'Birth of a Nation',
    story: 'Başlangıç limanına kendi sancağını diktin ve düzenli ordunun temelini attın.',
    storyEn: 'You raised your own banner at Starter Harbor and forged a standing army.',
    rewardGold: 220,
    isComplete: (s) => s.kingdomFounded,
    progressText: (s) => (s.kingdomFounded ? '1/1' : '0/1'),
  },
  {
    id: 'ms_5_first_conquest',
    chapter: 5,
    title: 'İlk Fetih',
    titleEn: 'First Conquest',
    story: 'Bir rakip kalenin surlarını düşürerek kendi sancağını göndere çektin.',
    storyEn: 'You broke a rival fortress and hoisted your banner over its ramparts.',
    rewardGold: 300,
    isComplete: (s) => s.conqueredIslandsCount >= 1,
    progressText: (s) => `${Math.min(1, s.conqueredIslandsCount)}/1`,
  },
  {
    id: 'ms_6_treasure_master',
    chapter: 6,
    title: 'Efsanevi Hazine Avcısı',
    titleEn: 'Master Treasure Hunter',
    story: 'On iki farklı gömüyü gün yüzüne çıkararak takımadaların en zengin kaptanı oldun.',
    storyEn: 'By unearthing twelve buried caches, you became the archipelago’s richest captain.',
    rewardGold: 380,
    isComplete: (s) => s.treasuresFoundCount >= 12,
    progressText: (s) => `${Math.min(12, s.treasuresFoundCount)}/12`,
  },
  {
    id: 'ms_7_relic_collector',
    chapter: 7,
    title: 'Karloff Günlükleri',
    titleEn: 'Relic Scholar',
    story: 'Kayıp kaptanların antik kalıntılarından dördünü müzene kazandırdın.',
    storyEn: 'You recovered four ancient relics left behind by vanished captains.',
    rewardGold: 450,
    isComplete: (s) => s.collectedRelicsCount >= 4,
    progressText: (s) => `${Math.min(4, s.collectedRelicsCount)}/4`,
  },
  {
    id: 'ms_8_armada',
    chapter: 8,
    title: 'Büyük Donanma',
    titleEn: 'Grand Armada',
    story: 'En az 3 refakat gemisi ve 15 askerle artık durdurulamaz bir filo yönetiyorsun.',
    storyEn: 'With at least 3 escort warships and 15 soldiers, your fleet is unstoppable.',
    rewardGold: 550,
    isComplete: (s) => s.escortShipCount >= 3 && s.soldiersCount >= 15,
    progressText: (s) => `${Math.min(3, s.escortShipCount)}/3 Gemi · ${Math.min(15, s.soldiersCount)}/15 Asker`,
  },
  {
    id: 'ms_9_storm_captain',
    chapter: 9,
    title: 'Fırtına Süvarisi',
    titleEn: 'Storm Rider',
    story: 'Büyük geminle (Sv.6+) okyanus fırtınalarından zaferle çıktın.',
    storyEn: 'With a mighty vessel (Lv.6+), you weathered fierce ocean storms.',
    rewardGold: 700,
    isComplete: (s) => s.boatLevel >= 6 && s.conqueredIslandsCount >= 3,
    progressText: (s) => `Gemi Sv.${s.boatLevel}/6 · ${Math.min(3, s.conqueredIslandsCount)}/3 Fetih`,
  },
  {
    id: 'ms_10_island_sultan',
    chapter: 10,
    title: 'Ada Sultanı (Son Meydan Okuma)',
    titleEn: 'Sultan of the Isles (Endgame)',
    story: '5 ada fethet, gemiyi 7. sınıfa çıkar ve 25 hazine açarak denizlerin mutlak hükümdarı ol!',
    storyEn: 'Conquer 5 islands, reach Ship Lv.7+, and unearth 25 treasures to rule the seas!',
    rewardGold: 1500,
    isComplete: (s) =>
      s.conqueredIslandsCount >= 5 && s.boatLevel >= 7 && s.treasuresFoundCount >= 25,
    progressText: (s) =>
      `${Math.min(5, s.conqueredIslandsCount)}/5 Fetih · Gemi Sv.${Math.min(7, s.boatLevel)}/7 · ${Math.min(25, s.treasuresFoundCount)}/25 Hazine`,
  },
];

export interface AchievementDef {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  rewardGold: number;
  check: (s: CampaignStatsInput) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach_dig_1',
    title: 'İlk Kürek Darbesi',
    titleEn: 'First Shovel Strike',
    description: '1 hazine sandığı çıkar.',
    descriptionEn: 'Dig up 1 treasure chest.',
    tier: 'BRONZE',
    rewardGold: 40,
    check: (s) => s.treasuresFoundCount >= 1,
  },
  {
    id: 'ach_dig_10',
    title: 'Altın İz Sürücü',
    titleEn: 'Gold Tracker',
    description: '10 hazine sandığı çıkar.',
    descriptionEn: 'Dig up 10 treasure chests.',
    tier: 'SILVER',
    rewardGold: 150,
    check: (s) => s.treasuresFoundCount >= 10,
  },
  {
    id: 'ach_dig_30',
    title: 'Hazine Efsanesi',
    titleEn: 'Treasure Legend',
    description: '30 hazine sandığı çıkar.',
    descriptionEn: 'Dig up 30 treasure chests.',
    tier: 'GOLD',
    rewardGold: 400,
    check: (s) => s.treasuresFoundCount >= 30,
  },
  {
    id: 'ach_sink_1',
    title: 'İlk Borda Ateşi',
    titleEn: 'First Broadside',
    description: '1 düşman gemisi batır.',
    descriptionEn: 'Sink 1 enemy ship.',
    tier: 'BRONZE',
    rewardGold: 50,
    check: (s) => s.enemiesSunkCount >= 1,
  },
  {
    id: 'ach_sink_15',
    title: 'Açık Deniz Hakimi',
    titleEn: 'Open Sea Master',
    description: '15 düşman gemisi batır.',
    descriptionEn: 'Sink 15 enemy ships.',
    tier: 'SILVER',
    rewardGold: 220,
    check: (s) => s.enemiesSunkCount >= 15,
  },
  {
    id: 'ach_sink_40',
    title: 'Denizlerin Kabusu',
    titleEn: 'Terror of the Deep',
    description: '40 düşman gemisi batır.',
    descriptionEn: 'Sink 40 enemy ships.',
    tier: 'GOLD',
    rewardGold: 500,
    check: (s) => s.enemiesSunkCount >= 40,
  },
  {
    id: 'ach_land_25',
    title: 'Kıyı Baskıncısı',
    titleEn: 'Shore Raider',
    description: '25 kara düşmanı yen.',
    descriptionEn: 'Defeat 25 land enemies.',
    tier: 'BRONZE',
    rewardGold: 90,
    check: (s) => s.landEnemiesDefeated >= 25,
  },
  {
    id: 'ach_land_100',
    title: 'Kale Kırıcı',
    titleEn: 'Fortress Breaker',
    description: '100 kara düşmanı yen.',
    descriptionEn: 'Defeat 100 land enemies.',
    tier: 'SILVER',
    rewardGold: 260,
    check: (s) => s.landEnemiesDefeated >= 100,
  },
  {
    id: 'ach_discover_5',
    title: 'Kartograf',
    titleEn: 'Cartographer',
    description: '5 farklı ada keşfet.',
    descriptionEn: 'Discover 5 different islands.',
    tier: 'BRONZE',
    rewardGold: 80,
    check: (s) => s.discoveredIslandsCount >= 5,
  },
  {
    id: 'ach_discover_15',
    title: 'Dünya Kaşifi',
    titleEn: 'World Explorer',
    description: '15 farklı ada keşfet.',
    descriptionEn: 'Discover 15 different islands.',
    tier: 'GOLD',
    rewardGold: 350,
    check: (s) => s.discoveredIslandsCount >= 15,
  },
  {
    id: 'ach_conquer_1',
    title: 'Sancak Dikici',
    titleEn: 'Banner Planter',
    description: 'İlk adanı fethet.',
    descriptionEn: 'Conquer your first island.',
    tier: 'BRONZE',
    rewardGold: 100,
    check: (s) => s.conqueredIslandsCount >= 1,
  },
  {
    id: 'ach_conquer_5',
    title: 'Takımada İmparatoru',
    titleEn: 'Archipelago Emperor',
    description: '5 ada fethet.',
    descriptionEn: 'Conquer 5 islands.',
    tier: 'GOLD',
    rewardGold: 600,
    check: (s) => s.conqueredIslandsCount >= 5,
  },
  {
    id: 'ach_gold_1000',
    title: 'Zengin Tüccar',
    titleEn: 'Wealthy Merchant',
    description: 'Toplam 1.000 altın kazan.',
    descriptionEn: 'Earn 1,000 total gold.',
    tier: 'BRONZE',
    rewardGold: 75,
    check: (s) => s.totalGoldEarned >= 1000,
  },
  {
    id: 'ach_gold_10000',
    title: 'Altın Filosu',
    titleEn: 'Golden Fleet',
    description: 'Toplam 10.000 altın kazan.',
    descriptionEn: 'Earn 10,000 total gold.',
    tier: 'GOLD',
    rewardGold: 450,
    check: (s) => s.totalGoldEarned >= 10000,
  },
  {
    id: 'ach_relic_1',
    title: 'Antik İz',
    titleEn: 'Ancient Trace',
    description: 'İlk eşsiz kalıntıyı bul.',
    descriptionEn: 'Find your first unique relic.',
    tier: 'BRONZE',
    rewardGold: 100,
    check: (s) => s.collectedRelicsCount >= 1,
  },
  {
    id: 'ach_relic_6',
    title: 'Kalıntı Ustası',
    titleEn: 'Relic Master',
    description: '6 eşsiz kalıntı topla.',
    descriptionEn: 'Collect 6 unique relics.',
    tier: 'SILVER',
    rewardGold: 300,
    check: (s) => s.collectedRelicsCount >= 6,
  },
  {
    id: 'ach_relic_12',
    title: 'Büyük Koleksiyoncu',
    titleEn: 'Grand Collector',
    description: 'Tüm 12 kalıntıyı tamamla.',
    descriptionEn: 'Complete all 12 relics.',
    tier: 'GOLD',
    rewardGold: 1000,
    check: (s) => s.collectedRelicsCount >= 12,
  },
  {
    id: 'ach_ship_8',
    title: 'Amiral Kalyonu',
    titleEn: 'Admiral Flagship',
    description: 'Gemi sınıfını 8. seviyeye yükselt.',
    descriptionEn: 'Upgrade ship class to level 8.',
    tier: 'GOLD',
    rewardGold: 650,
    check: (s) => s.boatLevel >= 8,
  },
  {
    id: 'ach_storm_1',
    title: 'Fırtına Kaptanı',
    titleEn: 'Storm Captain',
    description: 'Bir açık deniz fırtınasından sağ çık.',
    descriptionEn: 'Survive an open sea storm.',
    tier: 'SILVER',
    rewardGold: 120,
    check: (s) => s.stormsSurvivedCount >= 1,
  },
  {
    id: 'ach_army_25',
    title: 'Büyük Tabur',
    titleEn: 'Grand Battalion',
    description: 'Aynı anda 25 askere komuta et.',
    descriptionEn: 'Command 25 soldiers at once.',
    tier: 'SILVER',
    rewardGold: 200,
    check: (s) => s.soldiersCount >= 25,
  },
];

export interface TutorialHintDef {
  id: string;
  title: string;
  titleEn: string;
  text: string;
  textEn: string;
}

export const TUTORIAL_STEPS: TutorialHintDef[] = [
  {
    id: 'tut_radar',
    title: 'Adım 1 · Hazineyi Tara',
    titleEn: 'Step 1 · Scan for Treasure',
    text: 'R tuşuna (veya Radar butonuna) basarak yakındaki gömülü hazinenin yönünü ve sıcaklığını ölç.',
    textEn: 'Press R (or Radar button) to sense the direction and heat of buried treasure.',
  },
  {
    id: 'tut_dig',
    title: 'Adım 2 · Toprağı Kaz',
    titleEn: 'Step 2 · Dig the Sand',
    text: 'Radar "Çok Sıcak" dediğinde Boşluk tuşu (veya Kazı Yap) ile sandığı ortaya çıkar!',
    textEn: 'When Radar says Hot, press Space (or Dig) to unearth the treasure chest!',
  },
  {
    id: 'tut_boat',
    title: 'Adım 3 · Tekneye Bin & Yelken Aç',
    titleEn: 'Step 3 · Board & Set Sail',
    text: 'Kıyıdaki teknene yaklaşıp E tuşuna bas, sonra Tüccar İskelesi’ne uğra veya yeni adalar keşfet.',
    textEn: 'Approach your boat and press E to sail to the Trader Dock or discover new islands.',
  },
  {
    id: 'tut_shop',
    title: 'Adım 4 · Tüccarla Ticaret Yap',
    titleEn: 'Step 4 · Trade at the Dock',
    text: 'Altın sandıklı Tüccar İskelesi’nde T tuşuna basarak hazinelerini sat ve gemi/kürek geliştir.',
    textEn: 'At the Trader Dock, press T to sell treasures and upgrade your ship and gear.',
  },
  {
    id: 'tut_kingdom',
    title: 'Adım 5 · Devlet Kur & Fethet',
    titleEn: 'Step 5 · Found Your Kingdom',
    text: 'K tuşuna basarak kendi devletini kur, asker topla ve Q tuşuyla Savaş Emri ver!',
    textEn: 'Press K to found your kingdom, recruit troops, and use Q for Tactical War Cry!',
  },
];

export interface PetDef {
  id: 'PARROT' | 'MONKEY' | 'TURTLE';
  name: string;
  nameEn: string;
  cost: number;
  color: string;
  accentColor: string;
  bonusLabel: string;
  bonusLabelEn: string;
  description: string;
  descriptionEn: string;
}

export const PET_DEFS: PetDef[] = [
  {
    id: 'PARROT',
    name: 'Kızıl Papağan',
    nameEn: 'Scarlet Parrot',
    cost: 240,
    color: '#EF4444',
    accentColor: '#FDE047',
    bonusLabel: '+%25 Radar Menzili',
    bonusLabelEn: '+25% Radar Range',
    description: 'Gökyüzünden adaları tarayarak hazine radar menzilini %25 artırır.',
    descriptionEn: 'Scouts from the sky, expanding treasure radar detection range by 25%.',
  },
  {
    id: 'MONKEY',
    name: 'Altın Maymun',
    nameEn: 'Golden Monkey',
    cost: 320,
    color: '#D97706',
    accentColor: '#FDE68A',
    bonusLabel: '+85px Ganimet Çekimi & +%10 Altın',
    bonusLabelEn: '+85px Loot Magnet & +10% Gold',
    description: 'Kara ganimetlerini uzaktan toplar ve düşen altın miktarını %10 artırır.',
    descriptionEn: 'Collects land loot from further away and boosts dropped gold by 10%.',
  },
  {
    id: 'TURTLE',
    name: 'Zırhlı Deniz Kaplumbağası',
    nameEn: 'Armored Sea Turtle',
    cost: 380,
    color: '#10B981',
    accentColor: '#6EE7B7',
    bonusLabel: '+1.5 Gemi Can/sn & Fırtına Direnci',
    bonusLabelEn: '+1.5 Boat HP/s & Storm Resistance',
    description: 'Yelken açarken gövdeyi yavaşça onarır ve fırtına hasarını azaltır.',
    descriptionEn: 'Passively repairs hull while sailing and softens storm damage.',
  },
];

export interface FishTemplate {
  id: string;
  name: string;
  nameEn: string;
  goldValue: number;
  rarityLabel: string;
  rarityLabelEn: string;
  color: string;
  isRarePearl?: boolean;
}

export const FISH_TEMPLATES: FishTemplate[] = [
  {
    id: 'fish_anchovy',
    name: 'Gümüş Sardalya',
    nameEn: 'Silver Sardine',
    goldValue: 18,
    rarityLabel: 'Sıradan',
    rarityLabelEn: 'Common',
    color: '#94A3B8',
  },
  {
    id: 'fish_snapper',
    name: 'Mercan Çipura',
    nameEn: 'Coral Snapper',
    goldValue: 32,
    rarityLabel: 'Sıradan',
    rarityLabelEn: 'Common',
    color: '#FB7185',
  },
  {
    id: 'fish_tuna',
    name: 'Mavi Yüzgeç Orkinos',
    nameEn: 'Bluefin Tuna',
    goldValue: 55,
    rarityLabel: 'Nadir',
    rarityLabelEn: 'Rare',
    color: '#38BDF8',
  },
  {
    id: 'fish_sword',
    name: 'Kral Kılıçbalığı',
    nameEn: 'Royal Swordfish',
    goldValue: 90,
    rarityLabel: 'Destansı',
    rarityLabelEn: 'Epic',
    color: '#A855F7',
  },
  {
    id: 'fish_golden_carp',
    name: 'Altın Lagün Balığı',
    nameEn: 'Golden Lagoon Fish',
    goldValue: 135,
    rarityLabel: 'Efsanevi',
    rarityLabelEn: 'Legendary',
    color: '#FBBF24',
  },
  {
    id: 'fish_pearl',
    name: 'Nadir Altın İnci',
    nameEn: 'Rare Golden Pearl',
    goldValue: 210,
    rarityLabel: 'Eşsiz İnci',
    rarityLabelEn: 'Unique Pearl',
    color: '#FDE047',
    isRarePearl: true,
  },
];

export function rollCatchFish(luckLevel = 1, boostActive = false): FishTemplate {
  const luckBonus = Math.max(0, luckLevel - 1) * 0.04 + (boostActive ? 0.12 : 0);
  const r = Math.random() - luckBonus * 0.45;
  if (r < 0.06) return FISH_TEMPLATES[5]; // Golden Pearl
  if (r < 0.16) return FISH_TEMPLATES[4]; // Golden Lagoon Fish
  if (r < 0.34) return FISH_TEMPLATES[3]; // Swordfish
  if (r < 0.58) return FISH_TEMPLATES[2]; // Tuna
  if (r < 0.80) return FISH_TEMPLATES[1]; // Coral Snapper
  return FISH_TEMPLATES[0]; // Silver Sardine
}

export interface CaptainLogDef {
  id: string;
  chapter: number;
  title: string;
  titleEn: string;
  author: string;
  excerpt: string;
  excerptEn: string;
  secretClue: string;
  secretClueEn: string;
  rewardGold: number;
}

export const CAPTAIN_LOGS: CaptainLogDef[] = [
  {
    id: 'log_01_karloff_start',
    chapter: 1,
    title: 'Kaptan Karloff’un İlk Pusulası',
    titleEn: "Captain Karloff's First Compass",
    author: 'Kaptan Karloff',
    excerpt: 'Bu takımadalarda altın sadece kumun altında değil, mercan kayalıklarının gölgesinde saklanır. Sıcak-soğuk ibresi titrediğinde küreği derine vur.',
    excerptEn: 'In these isles gold hides not only under sand, but in reef shadows. When the hot-cold needle quivers, dig deep.',
    secretClue: 'Derin gömüler bazen 2–3 kürek darbesi gerektirir.',
    secretClueEn: 'Deep chests sometimes require 2–3 shovel strikes.',
    rewardGold: 35,
  },
  {
    id: 'log_02_storm_wind',
    chapter: 2,
    title: 'Kış Fırtınalarının Sırrı',
    titleEn: 'Secret of Winter Squalls',
    author: 'Amiral Veysel',
    excerpt: 'Kış ve sonbahar rüzgarları gülleleri saptırır; ancak cesur kaptanlar fırtınada batırdıkları gemilerden yarım kat daha fazla ganimet çıkarır.',
    excerptEn: 'Winter and autumn gales bend cannon arcs, yet bold captains haul 50% richer bounty from ships sunk in storms.',
    secretClue: 'Fırtınada borda ateşini rüzgar yönüne göre önden ver.',
    secretClueEn: 'Lead broadsides slightly upwind during ocean storms.',
    rewardGold: 40,
  },
  {
    id: 'log_03_sun_temple',
    chapter: 3,
    title: 'Güneş Tapınağı Yazıtı',
    titleEn: 'Sun Temple Inscription',
    author: 'Altın Güneş Rahibi',
    excerpt: 'Güneyin zümrüt vahalarında dikilen obeliskler, Antik Güneş Seti parçalarının gömülü olduğu kumsalları korur.',
    excerptEn: 'Obelisks standing in southern oases guard beaches holding pieces of the Ancient Sun Set.',
    secretClue: 'Kalıntılar ve Altın Güneş seti hazine değerini %20 artırır.',
    secretClueEn: 'Completing the Ancient Sun Relics set boosts treasure value by +20%.',
    rewardGold: 45,
  },
  {
    id: 'log_04_healer_brig',
    chapter: 4,
    title: 'Şifacı Kalyonların Zaafı',
    titleEn: 'Weakness of Repair Frigates',
    author: 'İmparatorluk Mühendisi',
    excerpt: 'Düşman filolarındaki yeşil haçlı tamir gemileri önce batırılmazsa, yaralı kalyonlar asla düşmez.',
    excerptEn: 'Unless green-cross repair ships in enemy squadrons are sunk first, wounded galleons endure.',
    secretClue: 'Önce yeşil haçlı şifacı gemiyi hedef al!',
    secretClueEn: 'Focus fire on green-cross healer ships first!',
    rewardGold: 45,
  },
  {
    id: 'log_05_iron_coast',
    chapter: 5,
    title: 'Demir ve Kereste Rezervleri',
    titleEn: 'Timber & Iron Deposits',
    author: 'Usta Marangoz Halim',
    excerpt: 'Her adadaki kütük ve demir yığınlarını kılıç veya kürekle topla. Bunlar açık denizde tamir kiti ve kale topu kulesi için paha biçilmezdir.',
    excerptEn: 'Harvest timber and iron veins on every island. They forge Repair Kits and Fort Defense Turrets.',
    secretClue: '2 Odun + 1 Demir ile ücretsiz Gemi Tamir Kiti üretebilirsin.',
    secretClueEn: 'Craft Repair Kits with 2 Wood + 1 Iron at the Workshop.',
    rewardGold: 50,
  },
  {
    id: 'log_06_deep_lagoon',
    chapter: 6,
    title: 'Kara Lagün’ün Kayıp İncileri',
    titleEn: 'Lost Pearls of Dark Lagoon',
    author: 'Kaptan Elif',
    excerpt: 'Kıyıda olta sallayan sabırlı denizciler, yalnızca balık değil; tüccarların servet ödediği Altın İnciler de yakalar.',
    excerptEn: 'Patient mariners casting a line from shore hook not just fish, but Golden Pearls prized by merchants.',
    secretClue: 'Şans seviyesi yükseldikçe olta nadir Altın İnci yakalar.',
    secretClueEn: 'Higher Luck level raises Golden Pearl catch odds.',
    rewardGold: 50,
  },
  {
    id: 'log_07_fort_siege',
    chapter: 7,
    title: 'Kale Surları ve Humbaracılar',
    titleEn: 'Fort Ramparts & Grenadiers',
    author: 'Kuşatma Ustası Timur',
    excerpt: 'Ağır Zırhlı Muhafızlar ve Humbaracılar rakip kalelerin taş surlarını hızla çökertir; ardından kale sancağını dikmek saniyeler sürer.',
    excerptEn: 'Heavy Guards and Grenadiers shatter stone fortress walls swiftly, opening the ramparts to capture.',
    secretClue: '[Q] Savaş Emri tüm asker sınıflarının özel yeteneklerini tetikler.',
    secretClueEn: '[Q] War Cry triggers unique class ultimates for all soldiers.',
    rewardGold: 55,
  },
  {
    id: 'log_08_pet_bond',
    chapter: 8,
    title: 'Sadık Deniz Yoldaşları',
    titleEn: 'Loyal Sea Companions',
    author: 'Gezgin Botanist',
    excerpt: 'Papağan ufku tarar, Altın Maymun dökülen altınları kapar, Zırhlı Kaplumbağa ise gövdeyi açık denizde tamir eder.',
    excerptEn: 'Parrots widen radar sweeps, Golden Monkeys magnetize loot, and Armored Turtles mend your hull at sea.',
    secretClue: 'Mağazadaki Evcil Hayvan sekmesinden görevine uygun yoldaşı seç.',
    secretClueEn: 'Swap active pets anytime from the Pets tab in the Merchant Shop.',
    rewardGold: 55,
  },
  {
    id: 'log_09_minefields',
    chapter: 9,
    title: 'Serseri Deniz Mayınları',
    titleEn: 'Rogue Sea Mines',
    author: 'Korsan Gözcü',
    excerpt: 'Açık denizdeki dikenli mayınlara çarpmadan önce yan toplarla onları patlat; sürüklenen variller ise her zaman bedava malzeme taşır.',
    excerptEn: 'Detonate spiked sea mines from afar with broadside cannonballs; drifting barrels hold free supplies.',
    secretClue: 'Top gülleleri temas ettiği deniz mayınlarını patlatır.',
    secretClueEn: 'Cannonballs safely detonate sea mines on impact.',
    rewardGold: 60,
  },
  {
    id: 'log_10_karloff_crown',
    chapter: 10,
    title: 'Karloff’un Son Vasiyeti',
    titleEn: "Karloff's Final Testament",
    author: 'Kaptan Karloff',
    excerpt: 'Beş adada sancağını dalgalandıran, Amiral Armadasını kuran ve yirmi beş sandık çıkaran kaptan gerçek Ada Sultanı unvanını taşır.',
    excerptEn: 'The captain who flies banners over 5 isles, sails an Admiral Flagship, and digs 25 chests claims the Sultan crown.',
    secretClue: 'Tüm Karloff sayfaları +20% Hazine Değeri ve +15% Şans kazandırır.',
    secretClueEn: 'All 10 logs grant +20% Treasure Value and +15% Rare Find Luck.',
    rewardGold: 100,
  },
];

export function getCaptainLogBonuses(discoveredLogIds: string[]): {
  count: number;
  treasureValueMult: number;
  rareLuckBonus: number;
} {
  const count = Math.min(CAPTAIN_LOGS.length, new Set(discoveredLogIds).size);
  return {
    count,
    treasureValueMult: 1 + count * 0.02,
    rareLuckBonus: count * 0.015,
  };
}


