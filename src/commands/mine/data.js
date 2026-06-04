const COOLDOWN = 30 * 60 * 1000;

const TIERS = [
    { min: 0,      label: 'Surface Mine', dist: { empty: 6, coal: 5, iron: 3, gold: 2, ruby: 0, diamond: 0, cavein: 0 } },
    { min: 25000,  label: 'Cave',         dist: { empty: 4, coal: 4, iron: 3, gold: 2, ruby: 1, diamond: 0, cavein: 2 } },
    { min: 100000, label: 'Deep Cave',    dist: { empty: 2, coal: 3, iron: 3, gold: 3, ruby: 2, diamond: 1, cavein: 2 } },
    { min: 500000, label: 'Magma Core',   dist: { empty: 1, coal: 2, iron: 2, gold: 3, ruby: 3, diamond: 2, cavein: 3 } },
];

const ORES = {
    empty:   { emoji: '⬛', min: 0,     max: 0      },
    coal:    { emoji: '⚫', min: 10,    max: 50     },
    iron:    { emoji: '⬜', min: 50,    max: 150    },
    gold:    { emoji: '🟡', min: 200,   max: 700    },
    ruby:    { emoji: '🔴', min: 800,   max: 2500   },
    diamond: { emoji: '💎', min: 4000,  max: 12000  },
    cavein:  { emoji: '💥', min: 0,     max: 0      },
};

module.exports = { COOLDOWN, TIERS, ORES };
