const User = require('../models/user');

async function safeDM(client, userId, payload) {
    try {
        const user = await User.findOne({ userId, dmOptOut: true });
        if (user?.dmOptOut) return false;
        const discordUser = await client.users.fetch(userId);
        await discordUser.send(payload);
        return true;
    } catch {
        return false;
    }
}

module.exports = { safeDM };
