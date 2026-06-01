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
                { name: 'Economy',      value: '`/bank balance` `/bank deposit` `/bank withdraw` `/give` `/work` `/daily` `/lottery`', inline: false },
                { name: 'Gambling',     value: '`/gamble game:slots` `/gamble game:coinflip` `/gamble game:dice` `/gamble game:roulette` `/gamble game:blackjack` `/gamble game:high/low` `/rob` `/duel`', inline: false },
                { name: 'Stocks',       value: '`/stock list` `/stock buy` `/stock sell` `/stock portfolio` `/stock history`', inline: false },
                { name: 'Leaderboard',  value: '`/leaderboard`', inline: false },
                { name: 'Slave System', value: '`/slave buy` `/slave status` `/slave panel` `/slave list`', inline: false }
            )
            .setFooter({ text: 'Economic Bomb • All commands also work with the ? prefix' });

        if (admin) {
            embed.addFields({ name: 'Owner Only', value: '`/owner give` `/owner setbalance` `/owner setbank` `/owner stats` `/owner userinfo` `/owner jackpot` `/owner reseteconomy` `/owner clearcooldowns` `/owner setupmarket` `/owner stockfix` `/owner removestock` `/owner bounty` `/owner dm` `/owner panel` `/owner season2`', inline: false });
        }

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
