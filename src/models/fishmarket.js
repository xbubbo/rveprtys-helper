const mongoose = require('mongoose');

const fishMarketSchema = new mongoose.Schema({
    fishType:   { type: String, required: true, unique: true },
    soldLast24h:{ type: Number, default: 0 },
    lastReset:  { type: Date,   default: Date.now },
});

module.exports = mongoose.model('FishMarket', fishMarketSchema);
