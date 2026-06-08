const mongoose = require('mongoose');

const dividendClaimSchema = new mongoose.Schema({
    userId:    { type: String, required: true, unique: true },
    lastClaim: { type: Number, default: 0 },
});

module.exports = mongoose.models.DividendClaim || mongoose.model('DividendClaim', dividendClaimSchema);
