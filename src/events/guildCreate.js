const { EmbedBuilder } = require('discord.js');
const { seedMarket, COMPANIES } = require('../utils/market');

module.exports = {
    name: 'guildCreate',
    async execute(guild) {
        console.log(`Joined new guild: ${guild.name} (${guild.id})`);
        try {
            await seedMarket(guild.id);
            console.log(`Seeded stocks for ${guild.name}`);
        } catch (e) {
            console.error(`Failed to seed stocks for ${guild.name}:`, e);
        }

        const embed = new EmbedBuilder()
            .setTitle('💣 Economic Bomb has arrived!')
            .setDescription(
                `Thanks for adding **Economic Bomb** to your server!\n\n` +
                `The stock market has been automatically set up with **${COMPANIES.length} companies**.\n\n` +
                `**Getting started:**\n` +
                `> \`/help\` - view all commands\n` +
                `> \`/stock list\` - view the stock market\n` +
                `> \`/work\` - start earning money\n` +
                `> \`/daily\` - claim your daily reward`
            )
            .setColor(0xFFD700)
            .setFooter({ text: 'Economic Bomb' });

        try {
            const ch = guild.systemChannel ?? guild.channels.cache
                .filter(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'))
                .sort((a, b) => a.position - b.position).first();
            if (ch) await ch.send({ embeds: [embed] });
        } catch {}
    }
};
