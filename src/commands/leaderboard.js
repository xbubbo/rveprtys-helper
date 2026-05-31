const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

function buildPage(users, page, mode) {
    const totalPages = Math.ceil(users.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const slice = users.slice(start, start + PAGE_SIZE);

    const lines = slice.map((u, i) => {
        const pos = start + i;
        const prefix = MEDALS[pos] || `**${pos + 1}.**`;
        if (mode === 'wallet') return `${prefix} <@${u.userId}> - Wallet: **$${fmt(u.balance)}**`;
        if (mode === 'bank')   return `${prefix} <@${u.userId}> - Bank: **$${fmt(u.bank)}**`;
        return `${prefix} <@${u.userId}> - Wallet: **$${fmt(u.balance)}** | Bank: **$${fmt(u.bank)}**`;
    });

    const titles = { wallet: '💰 Wallet Leaderboard', bank: '🏦 Bank Leaderboard', both: '🏆 Leaderboard' };

    const embed = new EmbedBuilder()
        .setTitle(titles[mode] ?? titles.both)
        .setDescription(lines.join('\n') || 'No data yet.')
        .setColor(0xFFD700)
        .setFooter({ text: `Page ${page}/${totalPages} • ${users.length} players` });

    const row = new ActionRowBuilder();
    if (page > 1)            row.addComponents(new ButtonBuilder().setCustomId('lb_prev').setLabel('← Prev').setStyle(ButtonStyle.Secondary));
    if (page < totalPages)   row.addComponents(new ButtonBuilder().setCustomId('lb_next').setLabel('Next →').setStyle(ButtonStyle.Secondary));
    const components = row.components.length ? [row] : [];

    return { embed, components, totalPages };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top richest players')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Which balance to rank by (default: both)')
                .setRequired(false)
                .addChoices(
                    { name: 'Both (default)', value: 'both' },
                    { name: 'Wallet',         value: 'wallet' },
                    { name: 'Bank',           value: 'bank' }
                )
        ),

    async execute(interaction) {
        const mode = interaction.options.getString('location') ?? 'both';

        const allUsers = await User.find({ guildId: interaction.guild.id });
        if (!allUsers.length) return interaction.reply({ content: 'No data yet.', ephemeral: true });

        if (mode === 'bank')   allUsers.sort((a, b) => b.bank - a.bank);
        else if (mode === 'wallet') allUsers.sort((a, b) => b.balance - a.balance);
        else allUsers.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));

        let page = 1;
        const { embed, components, totalPages } = buildPage(allUsers, page, mode);
        const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

        if (totalPages <= 1) return;

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Run your own `/leaderboard` to navigate pages.', ephemeral: true });
            }
            if (i.customId === 'lb_next') page = Math.min(page + 1, totalPages);
            if (i.customId === 'lb_prev') page = Math.max(page - 1, 1);
            const { embed: e, components: c } = buildPage(allUsers, page, mode);
            await i.update({ embeds: [e], components: c });
        });

        collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
    }
};
