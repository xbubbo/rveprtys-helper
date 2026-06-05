const COOLDOWN = 10 * 1000;

const CATCH_ITEMS = {
    // Junk
    junk_seaweed:      { name: 'Seaweed',             emoji: '🌿', value: 2,       type: 'junk'    },
    junk_boot:         { name: 'Old Boot',             emoji: '👢', value: 3,       type: 'junk'    },
    junk_can:          { name: 'Tin Can',              emoji: '🥫', value: 5,       type: 'junk'    },
    junk_anchor:       { name: 'Rusty Anchor',         emoji: '⚓', value: 12,      type: 'junk'    },
    junk_bottle:       { name: 'Message in a Bottle',  emoji: '🍾', value: 40,      type: 'junk'    },
    // Common (Pond)
    fish_minnow:       { name: 'Minnow',               emoji: '🐟', value: 15,      type: 'fish'    },
    fish_goldfish:     { name: 'Goldfish',              emoji: '🐠', value: 30,      type: 'fish'    },
    fish_perch:        { name: 'Perch',                emoji: '🐡', value: 50,      type: 'fish'    },
    fish_sunfish:      { name: 'Sunfish',              emoji: '🐟', value: 130,     type: 'fish'    },
    fish_carp:         { name: 'Carp',                 emoji: '🐠', value: 200,     type: 'fish'    },
    // River
    fish_catfish:      { name: 'Catfish',              emoji: '🐡', value: 350,     type: 'fish'    },
    fish_bass:         { name: 'Bass',                 emoji: '🐟', value: 500,     type: 'fish'    },
    fish_walleye:      { name: 'Walleye',              emoji: '🐠', value: 700,     type: 'fish'    },
    fish_pike:         { name: 'Pike',                 emoji: '🐡', value: 900,     type: 'fish'    },
    fish_trout:        { name: 'Trout',                emoji: '🐟', value: 1100,    type: 'fish'    },
    // Ocean
    fish_cod:          { name: 'Cod',                  emoji: '🐠', value: 1400,    type: 'fish'    },
    fish_flounder:     { name: 'Flounder',             emoji: '🐡', value: 1800,    type: 'fish'    },
    fish_salmon:       { name: 'Salmon',               emoji: '🐟', value: 2200,    type: 'fish'    },
    fish_halibut:      { name: 'Halibut',              emoji: '🐠', value: 3000,    type: 'fish'    },
    fish_tuna:         { name: 'Tuna',                 emoji: '🐡', value: 4000,    type: 'fish'    },
    fish_grouper:      { name: 'Grouper',              emoji: '🐟', value: 5000,    type: 'fish'    },
    fish_mahi_mahi:    { name: 'Mahi-mahi',            emoji: '🐬', value: 6500,    type: 'fish'    },
    fish_swordfish:    { name: 'Swordfish',            emoji: '🐬', value: 8000,    type: 'fish'    },
    fish_wahoo:        { name: 'Wahoo',                emoji: '🐟', value: 10000,   type: 'fish'    },
    fish_marlin:       { name: 'Marlin',               emoji: '🐬', value: 13000,   type: 'fish'    },
    // Deep Sea
    fish_shark:        { name: 'Shark',                emoji: '🦈', value: 18000,   type: 'fish'    },
    fish_hammerhead:   { name: 'Hammerhead',           emoji: '🦈', value: 28000,   type: 'fish'    },
    fish_oarfish:      { name: 'Oarfish',              emoji: '🦑', value: 42000,   type: 'fish'    },
    fish_monster:      { name: 'Monster Fish',         emoji: '🐉', value: 65000,   type: 'monster' },
    fish_giant_squid:  { name: 'Giant Squid',          emoji: '🐙', value: 130000,  type: 'monster' },
    fish_blue_whale:   { name: 'Blue Whale',           emoji: '🐳', value: 280000,  type: 'monster' },
};

const WEIGHT_STATS = {
    junk_seaweed:     { min: 0.1,   max: 2,      avg: 1 },
    junk_boot:        { min: 0.5,   max: 5,      avg: 2.5 },
    junk_can:         { min: 0.1,   max: 1,      avg: 0.5 },
    junk_anchor:      { min: 8,     max: 80,     avg: 35 },
    junk_bottle:      { min: 0.5,   max: 3,      avg: 1.5 },
    fish_minnow:      { min: 0.1,   max: 0.8,    avg: 0.3 },
    fish_goldfish:    { min: 0.2,   max: 3,      avg: 1 },
    fish_perch:       { min: 0.5,   max: 5,      avg: 2 },
    fish_sunfish:     { min: 0.3,   max: 4,      avg: 1.5 },
    fish_carp:        { min: 2,     max: 40,     avg: 12 },
    fish_catfish:     { min: 3,     max: 80,     avg: 20 },
    fish_bass:        { min: 1,     max: 25,     avg: 6 },
    fish_walleye:     { min: 1,     max: 18,     avg: 5 },
    fish_pike:        { min: 2,     max: 45,     avg: 12 },
    fish_trout:       { min: 0.5,   max: 30,     avg: 6 },
    fish_cod:         { min: 2,     max: 90,     avg: 20 },
    fish_flounder:    { min: 1,     max: 25,     avg: 8 },
    fish_salmon:      { min: 3,     max: 60,     avg: 18 },
    fish_halibut:     { min: 10,    max: 300,    avg: 80 },
    fish_tuna:        { min: 20,    max: 600,    avg: 150 },
    fish_grouper:     { min: 10,    max: 400,    avg: 90 },
    fish_mahi_mahi:   { min: 5,     max: 80,     avg: 25 },
    fish_swordfish:   { min: 40,    max: 800,    avg: 200 },
    fish_wahoo:       { min: 10,    max: 180,    avg: 50 },
    fish_marlin:      { min: 80,    max: 1200,   avg: 300 },
    fish_shark:       { min: 80,    max: 1800,   avg: 500 },
    fish_hammerhead:  { min: 100,   max: 1200,   avg: 450 },
    fish_oarfish:     { min: 50,    max: 600,    avg: 150 },
    fish_monster:     { min: 200,   max: 2500,   avg: 700 },
    fish_giant_squid: { min: 300,   max: 2200,   avg: 900 },
    fish_blue_whale:  { min: 50000, max: 420000, avg: 240000 },
};

const TABLES = {
    pond: [
        ['junk_seaweed',6],['junk_boot',7],['junk_can',8],['junk_anchor',3],['junk_bottle',1],
        ['fish_minnow',30],['fish_goldfish',8],['fish_perch',18],['fish_sunfish',10],['fish_carp',7],
        ['fish_catfish',1],['fish_monster',0.2],
    ],
    river: [
        ['junk_can',4],['junk_bottle',2],
        ['fish_minnow',8],['fish_perch',10],['fish_sunfish',8],['fish_carp',10],
        ['fish_catfish',16],['fish_bass',16],['fish_walleye',12],['fish_pike',8],
        ['fish_trout',5],['fish_monster',0.4],
    ],
    ocean: [
        ['junk_bottle',1],
        ['fish_trout',5],['fish_cod',10],['fish_flounder',12],['fish_salmon',14],
        ['fish_halibut',14],['fish_tuna',14],['fish_grouper',10],['fish_mahi_mahi',8],
        ['fish_swordfish',6],['fish_wahoo',4],['fish_marlin',2],
        ['fish_monster',0.6],
    ],
    deepsea: [
        ['fish_tuna',8],['fish_grouper',5],['fish_mahi_mahi',6],['fish_swordfish',10],
        ['fish_wahoo',8],['fish_marlin',12],['fish_shark',18],['fish_hammerhead',10],
        ['fish_oarfish',5],['fish_monster',2.5],['fish_giant_squid',0.4],['fish_blue_whale',0.08],
    ],
};

const TIERS = [
    { min: 0,      loc: 'pond',    label: 'Pond'     },
    { min: 10000,  loc: 'river',   label: 'River'    },
    { min: 50000,  loc: 'ocean',   label: 'Ocean'    },
    { min: 200000, loc: 'deepsea', label: 'Deep Sea' },
];

const ROD_STATS = {
    fishing_rod_wooden:   { skip: 0, snapChance: 0.08,  multiChance: 0,    multiCount: 1 },
    fishing_rod_basic:    { skip: 1, snapChance: 0.04,  multiChance: 0,    multiCount: 1 },
    fishing_rod_upgraded: { skip: 2, snapChance: 0.02,  multiChance: 0.15, multiCount: 2 },
    fishing_rod_super:    { skip: 3, snapChance: 0.005, multiChance: 0.25, multiCount: 3 },
    fishing_rod_legendary:{ skip: 3, snapChance: 0.001, multiChance: 0.40, multiCount: 4 },
};

module.exports = { COOLDOWN, CATCH_ITEMS, WEIGHT_STATS, TABLES, TIERS, ROD_STATS };
