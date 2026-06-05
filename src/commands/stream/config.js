const COOLDOWN     = 45 * 60 * 1000;
const MAX_SEGMENTS = 20;

const TIERS = [
    { min: 0,      categories: ['fps', 'music']                          },
    { min: 50000,  categories: ['fps', 'music', 'rpg', 'variety']        },
    { min: 150000, categories: ['fps', 'music', 'rpg', 'variety', 'irl'] },
];

const CATEGORIES = {
    fps:     { label: 'FPS Gaming',  baseMin: 20,  baseMax: 80,  growthMin: 0.05, growthMax: 0.20, eventChance: 0.20 },
    rpg:     { label: 'RPG Gaming',  baseMin: 10,  baseMax: 50,  growthMin: 0.08, growthMax: 0.25, eventChance: 0.18 },
    music:   { label: 'Music',       baseMin: 5,   baseMax: 30,  growthMin: 0.03, growthMax: 0.15, eventChance: 0.15 },
    variety: { label: 'Variety',     baseMin: 10,  baseMax: 100, growthMin: 0,    growthMax: 0.35, eventChance: 0.22 },
    irl:     { label: 'IRL',         baseMin: 25,  baseMax: 120, growthMin: 0.10, growthMax: 0.30, eventChance: 0.30 },
};

module.exports = { COOLDOWN, MAX_SEGMENTS, TIERS, CATEGORIES };
