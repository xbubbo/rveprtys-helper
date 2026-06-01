const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
    guildId:    { type: String, required: true },
    type:       { type: String, enum: ['hourly', 'daily'], required: true },
    pot:        { type: Number, default: 0 },
    tickets:    [{ userId: String, count: { type: Number, default: 1 } }],
    drawAt:     { type: Date, required: true },
});

lotterySchema.index({ guildId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Lottery', lotterySchema);
