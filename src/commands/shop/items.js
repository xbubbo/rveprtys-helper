const ITEMS = {
    // General
    lifesaver: {
        emoji: '🛟', name: 'Lifesaver', price: 5000, category: 'general',
        description: 'Prevents the death penalty once. Grants a 5-minute +5% gambling boost when consumed.',
    },

    // Fishing
    fishing_rod_basic: {
        emoji: '🎣', name: 'Basic Fishing Rod', price: 800, category: 'fishing',
        description: 'Required to become a Fisher. Standard catch rates.',
    },
    fishing_rod_upgraded: {
        emoji: '🎣', name: 'Upgraded Fishing Rod', price: 4000, category: 'fishing',
        description: 'Removes the worst fish from the catch table - only mid to premium catches.',
        requires: 'fishing_rod_basic',
    },
    fishing_rod_super: {
        emoji: '🎣', name: 'Super Fishing Rod', price: 12000, category: 'fishing',
        description: 'Removes the two weakest fish from the table. Guaranteed quality catches.',
        requires: 'fishing_rod_upgraded',
    },
    fishing_bait: {
        emoji: '🪱', name: 'Fishing Bait', price: 150, category: 'fishing', consumable: true,
        description: 'Consumable. Auto-used when fishing - shifts the catch table toward rarer fish this session.',
    },
    fishing_bucket: {
        emoji: '🪣', name: 'Fishing Bucket', price: 1500, category: 'fishing',
        description: 'Catch two fish per successful reel-in instead of one.',
    },

    // Mining
    pickaxe_basic: {
        emoji: '⛏️', name: 'Basic Pickaxe', price: 1500, category: 'mining',
        description: 'Required to become a Miner. Standard mining performance.',
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
        description: 'The basics. Required first step to become a Streamer.',
    },
    camera: {
        emoji: '📷', name: 'Camera', price: 4000, category: 'streaming',
        description: 'Required to go live. Must own Keyboard & Mouse first.',
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

const CATEGORY_LABELS = {
    general:   '🏪 General',
    fishing:   '🎣 Fishing Gear',
    mining:    '⛏️ Mining Gear',
    streaming: '📺 Streaming Gear',
};

module.exports = { ITEMS, CATEGORY_LABELS };
