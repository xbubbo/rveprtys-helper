const ITEMS = {
    // General
    lifesaver: {
        emoji: '🛟', name: 'Lifesaver', price: 5000, category: 'general',
        description: 'Prevents the death penalty once. Grants a 5-minute +5% gambling boost when consumed.',
    },

    // Fishing - Rods (durability tracked in user.fishRodDurability)
    fishing_rod_wooden: {
        emoji: '🎣', name: 'Wooden Rod', price: 150, category: 'fishing',
        durability: 100,
        description: 'A flimsy rod. 100 casts before it breaks. Higher line snap chance.',
    },
    fishing_rod_basic: {
        emoji: '🎣', name: 'Basic Rod', price: 800, category: 'fishing',
        durability: 200, requires: 'fishing_rod_wooden',
        description: '200 casts. Lower snap chance. Slightly better catch table.',
    },
    fishing_rod_upgraded: {
        emoji: '🎣', name: 'Upgraded Rod', price: 4000, category: 'fishing',
        durability: 350, requires: 'fishing_rod_basic',
        description: '350 casts. Removes worst fish from the table. Chance to catch 2 fish.',
    },
    fishing_rod_super: {
        emoji: '🎣', name: 'Super Rod', price: 12000, category: 'fishing',
        durability: 500, requires: 'fishing_rod_upgraded',
        description: '500 casts. Top-tier fish only. Higher multi-catch chance. Near-zero snap.',
    },

    // Fishing - Bait
    fishing_bait: {
        emoji: '🪱', name: 'Fishing Bait', price: 150, category: 'fishing', consumable: true,
        description: 'Consumable. Shifts the catch table toward rarer fish this cast.',
    },

    // Fishing - Buckets (capacity and sell multiplier)
    bucket_wooden: {
        emoji: '🪣', name: 'Wooden Bucket', price: 100, category: 'fishing',
        slots: 10, sellMultiplier: 1.0,
        description: 'Holds 10 items. Required to go fishing.',
    },
    bucket_iron: {
        emoji: '🪣', name: 'Iron Bucket', price: 600, category: 'fishing',
        slots: 25, sellMultiplier: 1.0, requires: 'bucket_wooden',
        description: 'Holds 25 items.',
    },
    bucket_gold: {
        emoji: '🪣', name: 'Gold Bucket', price: 2500, category: 'fishing',
        slots: 50, sellMultiplier: 1.15, requires: 'bucket_iron',
        description: 'Holds 50 items. Sell contents for +15% value.',
    },
    bucket_diamond: {
        emoji: '🪣', name: 'Diamond Bucket', price: 8000, category: 'fishing',
        slots: 100, sellMultiplier: 1.30, requires: 'bucket_gold',
        description: 'Holds 100 items. Sell contents for +30% value.',
    },

    // Mining
    pickaxe_basic: {
        emoji: '⛏️', name: 'Basic Pickaxe', price: 1500, category: 'mining',
        description: 'Required to mine. Standard performance.',
    },
    pickaxe_iron: {
        emoji: '⛏️', name: 'Iron Pickaxe', price: 6000, category: 'mining',
        description: '+20% value on all ore found.',
        requires: 'pickaxe_basic',
    },
    pickaxe_diamond: {
        emoji: '💎', name: 'Diamond Pickaxe', price: 20000, category: 'mining',
        description: '+45% value on all ore found.',
        requires: 'pickaxe_iron',
    },
    mining_backpack: {
        emoji: '🎒', name: 'Mining Backpack', price: 3500, category: 'mining',
        description: 'Cave-ins only reduce your haul by 10% instead of 25%.',
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

// Rod IDs in tier order (worst → best)
const ROD_TIERS = ['fishing_rod_wooden', 'fishing_rod_basic', 'fishing_rod_upgraded', 'fishing_rod_super'];
const BUCKET_TIERS = ['bucket_wooden', 'bucket_iron', 'bucket_gold', 'bucket_diamond'];

const CATEGORY_LABELS = {
    general:   '🏪 General',
    fishing:   '🎣 Fishing Gear',
    mining:    '⛏️ Mining Gear',
    streaming: '📺 Streaming Gear',
};

module.exports = { ITEMS, ROD_TIERS, BUCKET_TIERS, CATEGORY_LABELS };
