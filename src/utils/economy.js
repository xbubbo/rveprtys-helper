const { EmbedBuilder } = require('discord.js');
const User = require('../models/user');

const MAX_BALANCE = 999_999_999_999_999;

// The economy is global - every server shares the same balances/inventories/etc.
// User documents no longer carry a guildId; one document per user, period.
// GLOBAL_GUILD_ID is kept only as the "home" Discord server - e.g. for posting
// global announcements (lottery draws, etc.) to a real channel.
const GLOBAL_GUILD_ID = '1495938292506562621';

async function getUser(userId) {
    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });
    return user;
}

async function anticheat(client, userId) {
    const u = await getUser(userId);
    if (u.balance + u.bank > MAX_BALANCE) {
        u.balance = 0;
        u.bank = 0;
        await u.save();
        try {
            const du = await client.users.fetch(userId);
            await du.send({
                embeds: [new EmbedBuilder()
                    .setTitle('Anti-Cheat Triggered')
                    .setDescription('Your balance was reset to $0 for exceeding the maximum allowed amount.')
                    .setColor(0xff0000)]
            });
        } catch { }
    }
}

module.exports = { getUser, anticheat, GLOBAL_GUILD_ID };
