const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/user');
const { buildPage } = require('./pages');

async function fetchUsers(guildId, mode) {
    if (mode === 'global' || mode === 'global-bank') {
        const users = await User.find();
        if (mode === 'global') users.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
        else                   users.sort((a, b) => b.bank - a.bank);
        return users;
    }

    const users = await User.find({ guildId });

    if (mode === 'bank')     return users.filter(u => u.bank > 0).sort((a, b) => b.bank - a.bank);
    if (mode === 'wallet')   return users.filter(u => u.balance > 0).sort((a, b) => b.balance - a.balance);
    if (mode === 'gambling') return users.filter(u => u.gamblingWinnings).sort((a, b) => (b.gamblingWinnings ?? 0) - (a.gamblingWinnings ?? 0));

    return users.filter(u => u.balance > 0 || u.bank > 0).sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top players')
        .addStringOption(o =>
            o.setName('location')
                .setDescription('Which stat to rank by (default: both)')
                .setRequired(false)
                .addChoices(
                    { name: 'Both (default)', value: 'both'        },
                    { name: 'Wallet',         value: 'wallet'      },
                    { name: 'Bank',           value: 'bank'        },
                    { name: 'Gambling',       value: 'gambling'    },
                    { name: 'Global',         value: 'global'      },
                    { name: 'Global Bank',    value: 'global-bank' },
                )
        ),

    async execute(interaction) {
        const mode  = interaction.options.getString('location') ?? 'both';
        const users = await fetchUsers(interaction.guild.id, mode);

        if (!users.length) return interaction.reply({ content: 'No data yet.', ephemeral: true });

        let page = 1;
        const { embed, components, totalPages } = buildPage(users, page, mode);
        const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

        if (totalPages <= 1) return;

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id)
                return i.reply({ content: 'Run your own `/leaderboard` to navigate pages.', ephemeral: true });
            if (i.customId === 'lb_next') page = Math.min(page + 1, totalPages);
            if (i.customId === 'lb_prev') page = Math.max(page - 1, 1);
            const { embed: e, components: c } = buildPage(users, page, mode);
            await i.update({ embeds: [e], components: c });
        });

        collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
    }
};
