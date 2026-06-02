const { EmbedBuilder } = require('discord.js');
const User = require('../models/user');

const MAX_BALANCE = 999_999_999_999_999;

async function getUser(userId, guildId) {
    let user = await User.findOne({ userId, guildId });
    if (!user) user = await User.create({ userId, guildId });
    return user;
}

async function anticheat(client, userId, guildId) {
    const u = await getUser(userId, guildId);
    if (u.balance + u.bank > MAX_BALANCE) {
        u.balance = 0;
        u.bank = 0;
        await u.save();
        try {
            const du = await client.users.fetch(userId);
            await du.send({ embeds: [new EmbedBuilder()
                .setTitle('Anti-Cheat Triggered')
                .setDescription('Your balance was reset to $0 for exceeding the maximum allowed amount.')
                .setColor(0xff0000)] });
        } catch {}
    }
}

module.exports = { getUser, anticheat };
