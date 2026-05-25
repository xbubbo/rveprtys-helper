const User = require('../models/User');

async function getUser(userId, guildId) {
    let user = await User.findOne({ userId, guildId });

    if (!user) {
        user = await User.create({ userId, guildId });
    }

    return user;
}

module.exports = { getUser };
