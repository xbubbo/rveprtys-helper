const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const OWNER_ID = '1453078748080504996';
const isAdmin  = i => i.user.id === OWNER_ID || !!i.member?.permissions?.has('Administrator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('View all available commands'),

    async execute(interaction) {
        const admin = isAdmin(interaction);

        const embed = new EmbedBuilder()
            .setTitle('Economic Bomb - Commands')
            .setColor(0x2b2d31)
            .addFields(
                { name: 'Economy',      value: '`/balance` `/deposit` `/withdraw` `/give` `/work` `/daily`', inline: false },
                { name: 'Gambling',     value: '`/coinflip` `/dice` `/slots` `/rob` `/duel`', inline: false },
                { name: 'Stocks',       value: '`/stocks` `/buystock` `/sellstock` `/portfolio` `/stockhistory`', inline: false },
                { name: 'Leaderboard',  value: '`/leaderboard`', inline: false },
                { name: 'Slave System', value: '`/buy` `/slave` `/slavepanel` `/slavelist`', inline: false }
            )
            .setFooter({ text: 'Economic Bomb • All commands also work with the ? prefix' });

        if (admin) {
            embed.addFields({ name: 'Admin Only', value: '`/ogive` `/osetbalance` `/osetbank` `/oresetleaderboard` `/oeconomystats` `/ouserinfo` `/ojackpotdrop` `/clearcooldowns` `/setupmarket` `/ostockfix` `/oremovestock`', inline: false });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
