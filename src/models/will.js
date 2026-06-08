const mongoose = require('mongoose');

const willSchema = new mongoose.Schema({
    userId:         { type: String, required: true, unique: true },
    beneficiaryId:  { type: String, required: true },
    amount:         { type: Number, required: true },
    note:           { type: String, default: '' },
    createdAt:      { type: Number, default: Date.now },
    inactivityDays: { type: Number, default: 30 },
    executed:       { type: Boolean, default: false },
});

module.exports = mongoose.models.Will || mongoose.model('Will', willSchema);
