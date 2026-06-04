const ITEMS = {
    // General
    lifesaver: {
        emoji: '🛟', name: 'Lifesaver', price: 5000, category: 'general',
        description: 'Prevents the death penalty once. Grants a 5-minute +5% gambling boost when consumed.',
    },

    // Fishing - Rods
    fishing_rod_wooden: {
        emoji: '🎣', name: 'Wooden Rod', price: 500, category: 'fishing',
        durability: 100,
        description: '100 casts. High snap chance. Starter rod.',
    },
    fishing_rod_basic: {
        emoji: '🎣', name: 'Basic Rod', price: 3000, category: 'fishing',
        durability: 200, requires: 'fishing_rod_wooden',
        description: '200 casts. Lower snap chance. Removes worst fish from the table.',
    },
    fishing_rod_upgraded: {
        emoji: '🎣', name: 'Upgraded Rod', price: 15000, category: 'fishing',
        durability: 350, requires: 'fishing_rod_basic',
        description: '350 casts. Removes bottom 2 fish tiers. Chance to catch 2 fish.',
    },
    fishing_rod_super: {
        emoji: '🎣', name: 'Super Rod', price: 60000, category: 'fishing',
        durability: 500, requires: 'fishing_rod_upgraded',
        description: '500 casts. Top-tier fish only. 25% chance to catch 3 fish.',
    },
    fishing_rod_legendary: {
        emoji: '🎣', name: 'Legendary Rod', price: 200000, category: 'fishing',
        durability: 750, requires: 'fishing_rod_super',
        description: '750 casts. 40% chance to catch 4 fish per cast. Near-zero snap.',
    },

    // Fishing - Bait
    fishing_bait: {
        emoji: '🪱', name: 'Fishing Bait', price: 500, category: 'fishing', consumable: true,
        description: 'Consumable. Shifts the catch table toward rarer fish this cast.',
    },

    // Fishing - Buckets
    bucket_wooden: {
        emoji: '🪣', name: 'Wooden Bucket', price: 500, category: 'fishing',
        slots: 10, sellMultiplier: 1.0,
        description: 'Holds 10 items. Required to go fishing.',
    },
    bucket_iron: {
        emoji: '🪣', name: 'Iron Bucket', price: 2500, category: 'fishing',
        slots: 25, sellMultiplier: 1.0, requires: 'bucket_wooden',
        description: 'Holds 25 items.',
    },
    bucket_gold: {
        emoji: '🪣', name: 'Gold Bucket', price: 12000, category: 'fishing',
        slots: 50, sellMultiplier: 1.10, requires: 'bucket_iron',
        description: 'Holds 50 items. Sell contents for +10% value.',
    },
    bucket_diamond: {
        emoji: '🪣', name: 'Diamond Bucket', price: 50000, category: 'fishing',
        slots: 100, sellMultiplier: 1.20, requires: 'bucket_gold',
        description: 'Holds 100 items. Sell contents for +20% value.',
    },
    bucket_crystal: {
        emoji: '🪣', name: 'Crystal Bucket', price: 175000, category: 'fishing',
        slots: 200, sellMultiplier: 1.40, requires: 'bucket_diamond',
        description: 'Holds 200 items. Sell contents for +40% value.',
    },

    // Mining - Pickaxes (durability tracked in user.pickaxeDurability)
    pickaxe_wooden: {
        emoji: '⛏️', name: 'Wooden Pickaxe', price: 500, category: 'mining',
        durability: 25,
        description: '25 sessions. Starter pickaxe. Low durability.',
    },
    pickaxe_basic: {
        emoji: '⛏️', name: 'Basic Pickaxe', price: 4000, category: 'mining',
        durability: 35, requires: 'pickaxe_wooden',
        description: '35 sessions. +15% ore value.',
    },
    pickaxe_iron: {
        emoji: '⛏️', name: 'Iron Pickaxe', price: 20000, category: 'mining',
        durability: 55, requires: 'pickaxe_basic',
        description: '55 sessions. +30% ore value.',
    },
    pickaxe_diamond: {
        emoji: '💎', name: 'Diamond Pickaxe', price: 75000, category: 'mining',
        durability: 80, requires: 'pickaxe_iron',
        description: '80 sessions. +55% ore value.',
    },
    pickaxe_netherite: {
        emoji: '🔱', name: 'Netherite Pickaxe', price: 250000, category: 'mining',
        durability: 120, requires: 'pickaxe_diamond',
        description: '120 sessions. +90% ore value. Endgame tier.',
    },
    mining_backpack: {
        emoji: '🎒', name: 'Mining Backpack', price: 3500, category: 'mining',
        description: 'Cave-ins only reduce your haul by 10% instead of 50%.',
    },
    mining_bomb: {
        emoji: '💥', name: 'Mining Bomb', price: 2500, category: 'mining', consumable: true,
        description: 'Consumable. Auto-reveals 3 safe ore tiles at the start of a mining session.',
    },

    // Streaming
    keyboard_mouse: {
        emoji: '⌨️', name: 'Keyboard & Mouse', price: 1000, category: 'streaming',
        description: 'The basics. Enables streaming. Expect 0-2 viewers.',
    },
    camera: {
        emoji: '📷', name: 'Camera', price: 4000, category: 'streaming',
        description: 'Noticeably boosts your viewer potential.',
        requires: 'keyboard_mouse',
    },
    ring_light: {
        emoji: '💡', name: 'Ring Light', price: 2500, category: 'streaming',
        description: '+10% viewer growth rate per segment.',
    },
    microphone: {
        emoji: '🎙️', name: 'Microphone', price: 7000, category: 'streaming',
        description: 'Drama events only reduce viewers by 10-20% instead of 30-45%.',
    },
    dedicated_server: {
        emoji: '🖥️', name: 'Dedicated Server', price: 18000, category: 'streaming',
        description: 'ISP outage chance reduced from 4% to 1%.',
    },
};

const ROD_TIERS     = ['fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded', 'fishing_rod_super', 'fishing_rod_legendary'];
const BUCKET_TIERS  = ['bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond', 'bucket_crystal'];
const PICKAXE_TIERS = ['pickaxe_wooden', 'pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond', 'pickaxe_netherite'];

const CATEGORY_LABELS = {
    general:   '🏪 General',
    fishing:   '🎣 Fishing Gear',
    mining:    '⛏️ Mining Gear',
    streaming: '📺 Streaming Gear',
};

module.exports = { ITEMS, ROD_TIERS, BUCKET_TIERS, PICKAXE_TIERS, CATEGORY_LABELS };
