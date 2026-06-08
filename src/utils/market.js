const Stock = require('../models/stock');

const COMPANIES = [
    { ticker: 'VLR',  name: 'Velera Inc',          price: 142.50 },
    { ticker: 'FRGS', name: "Frogiee's Arcade",     price: 34.20  },
    { ticker: 'DOGE', name: 'Doge UB',              price: 0.85   },
    { ticker: 'CHRI', name: 'Cherri Inc',            price: 58.00  },
    { ticker: 'TGLC', name: 'TGLSC Corp',            price: 210.00 },
    { ticker: 'GNMT', name: 'Gn Math',              price: 76.40  },
    { ticker: 'CNOS', name: 'Cine OS',              price: 99.99  },
    { ticker: 'OVCL', name: 'Overcloaked Corp',      price: 185.30 },
    { ticker: 'TRFL', name: 'Truffled Inc',          price: 47.60  },
    { ticker: 'LNR',  name: 'LUNAR Research Inc',    price: 320.00 },
    { ticker: 'VOID', name: 'Void Network Corp',     price: 5.55   },
    { ticker: 'HDR',  name: 'Hydra Network Corp',    price: 88.88  },
    { ticker: 'NRGX', name: 'NRG Exchange',          price: 500.00 },
    { ticker: 'PLSM', name: 'Plasma Dynamics Inc',   price: 63.75  },
    { ticker: 'ZRTH', name: 'Zeroth Systems',        price: 112.00 },
];

async function seedMarket() {
    for (const c of COMPANIES) {
        const exists = await Stock.findOne({ ticker: c.ticker });
        if (exists) continue;
        await Stock.create({ ...c, history: [c.price], totalShares: 0 });
    }
}

module.exports = { COMPANIES, seedMarket };
