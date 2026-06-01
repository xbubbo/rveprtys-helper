const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/user');

const { formatNumber } = require('../utils/format');
const PAGE_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

function buildPage(users, page, mode) {
    const totalPages = Math.ceil(users.length / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE;
    const slice = users.slice(start, start + PAGE_SIZE);

    const lines = slice.map((u, i) => {
        const pos = start + i;
        const prefix = MEDALS[pos] || `**${pos + 1}.**`;
        if (mode === 'wallet') return `${prefix} <@${u.userId}> - Wallet: **$${formatNumber(u.balance)}**`;
        if (mode === 'bank') return `${prefix} <@${u.userId}> - Bank: **$${formatNumber(u.bank)}**`;
        if (mode === 'gambling') { const net = u.gamblingWinnings ?? 0; return `${prefix} <@${u.userId}> - Net: **${net >= 0 ? '+' : ''}$${formatNumber(net)}**`; }
        if (mode === 'global') return `${prefix} <@${u.userId}> - **$${formatNumber(u.balance + u.bank)}**`;
        if (mode === 'global-bank') return `${prefix} <@${u.userId}> - Bank: **$${formatNumber(u.bank)}**`;
        const first = u.bank >= u.balance ? `Bank: **$${formatNumber(u.bank)}**` : `Wallet: **$${formatNumber(u.balance)}**`;
        const second = u.bank >= u.balance ? `Wallet: **$${formatNumber(u.balance)}**` : `Bank: **$${formatNumber(u.bank)}**`;
        return `${prefix} <@${u.userId}> - ${first} | ${second}`;
    });

    const titles = {
        wallet: 'Wallet Leaderboard',
        bank: 'Bank Leaderboard',
        gambling: 'Gambling Leaderboard',
        global: 'Global Leaderboard',
        'global-bank': 'Global Bank Leaderboard',
        both: 'Leaderboard',
    };

    const embed = new EmbedBuilder()
        .setTitle(titles[mode] ?? titles.both)
        .setDescription(lines.join('\n') || 'No data yet.')
        .setColor(mode === 'gambling' ? 0xFF4500 : 0xFFD700)
        .setFooter({ text: `Page ${page}/${totalPages} • ${users.length} players` });

    const row = new ActionRowBuilder();
    if (page > 1) row.addComponents(new ButtonBuilder().setCustomId('lb_prev').setLabel('← Prev').setStyle(ButtonStyle.Secondary));
    if (page < totalPages) row.addComponents(new ButtonBuilder().setCustomId('lb_next').setLabel('Next →').setStyle(ButtonStyle.Secondary));
    const components = row.components.length ? [row] : [];

    return { embed, components, totalPages };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the top players')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Which stat to rank by (default: both)')
                .setRequired(false)
                .addChoices(
                    { name: 'Both (default)', value: 'both' },
                    { name: 'Wallet', value: 'wallet' },
                    { name: 'Bank', value: 'bank' },
                    { name: 'Gambling', value: 'gambling' },
                    { name: 'Global', value: 'global' },
                    { name: 'Global Bank', value: 'global-bank' }
                )
        ),

    async execute(interaction) {
        const mode = interaction.options.getString('location') ?? 'both';

        const allUsers = await User.find({ guildId: interaction.guild.id });
        if (!allUsers.length) return interaction.reply({ content: 'No data yet.', ephemeral: true });

        if (mode === 'global' || mode === 'global-bank') {
            const allGlobal = await User.find();
            if (mode === 'global') allGlobal.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
            else allGlobal.sort((a, b) => b.bank - a.bank);
            allUsers.length = 0;
            allUsers.push(...allGlobal);
        } else if (mode === 'bank') {
            allUsers.splice(0, allUsers.length, ...allUsers.filter(u => u.bank > 0));
            allUsers.sort((a, b) => b.bank - a.bank);
        } else if (mode === 'wallet') {
            allUsers.splice(0, allUsers.length, ...allUsers.filter(u => u.balance > 0));
            allUsers.sort((a, b) => b.balance - a.balance);
        } else if (mode === 'gambling') {
            allUsers.splice(0, allUsers.length, ...allUsers.filter(u => u.gamblingWinnings != null && u.gamblingWinnings !== 0));
            allUsers.sort((a, b) => (b.gamblingWinnings ?? 0) - (a.gamblingWinnings ?? 0));
        } else {
            allUsers.splice(0, allUsers.length, ...allUsers.filter(u => u.balance > 0 || u.bank > 0));
            allUsers.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
        }

        let page = 1;
        const { embed, components, totalPages } = buildPage(allUsers, page, mode);
        const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });

        if (totalPages <= 1) return;

        const collector = msg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id)
                return i.reply({ content: 'Run your own `/leaderboard` to navigate pages.', ephemeral: true });
            if (i.customId === 'lb_next') page = Math.min(page + 1, totalPages);
            if (i.customId === 'lb_prev') page = Math.max(page - 1, 1);
            const { embed: e, components: c } = buildPage(allUsers, page, mode);
            await i.update({ embeds: [e], components: c });
        });

        collector.on('end', () => { msg.edit({ components: [] }).catch(() => { }); });
    }
};
