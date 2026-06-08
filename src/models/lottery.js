const mongoose = require('mongoose');

const lotterySchema = new mongoose.Schema({
    type:       { type: String, enum: ['hourly', 'daily'], required: true, unique: true },
    pot:        { type: Number, default: 0 },
    tickets:    [{ userId: String, count: { type: Number, default: 1 } }],
    drawAt:     { type: Date, required: true },
});

module.exports = mongoose.model('Lottery', lotterySchema);
