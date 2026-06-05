const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');

const PAGE_SIZE = 10;
const MEDALS    = ['🥇', '🥈', '🥉'];

const TITLES = {
    wallet:       'Wallet Leaderboard',
    bank:         'Bank Leaderboard',
    gambling:     'Gambling Leaderboard',
    global:       'Global Leaderboard',
    'global-bank':'Global Bank Leaderboard',
    both:         'Leaderboard',
};

function buildPage(users, page, mode) {
    const totalPages = Math.ceil(users.length / PAGE_SIZE);
    const start      = (page - 1) * PAGE_SIZE;
    const slice      = users.slice(start, start + PAGE_SIZE);

    const lines = slice.map((u, i) => {
        const pos    = start + i;
        const prefix = MEDALS[pos] ?? `**${pos + 1}.**`;

        if (mode === 'wallet')      return `${prefix} <@${u.userId}> - Wallet: **$${formatNumber(u.balance)}**`;
        if (mode === 'bank')        return `${prefix} <@${u.userId}> - Bank: **$${formatNumber(u.bank)}**`;
        if (mode === 'global')      return `${prefix} <@${u.userId}> - **$${formatNumber(u.balance + u.bank)}**`;
        if (mode === 'global-bank') return `${prefix} <@${u.userId}> - Bank: **$${formatNumber(u.bank)}**`;
        if (mode === 'gambling') {
            const net = u.gamblingWinnings ?? 0;
            return `${prefix} <@${u.userId}> - Net: **${net >= 0 ? '+' : ''}$${formatNumber(net)}**`;
        }
        const higher = u.bank >= u.balance
            ? `Bank: **$${formatNumber(u.bank)}**`
            : `Wallet: **$${formatNumber(u.balance)}**`;
        const lower = u.bank >= u.balance
            ? `Wallet: **$${formatNumber(u.balance)}**`
            : `Bank: **$${formatNumber(u.bank)}**`;
        return `${prefix} <@${u.userId}> - ${higher} | ${lower}`;
    });

    const embed = new EmbedBuilder()
        .setTitle(TITLES[mode] ?? TITLES.both)
        .setDescription(lines.join('\n') || 'No data yet.')
        .setColor(mode === 'gambling' ? 0xFF4500 : 0xFFD700)
        .setFooter({ text: `Page ${page}/${totalPages} • ${users.length} players` });

    const row = new ActionRowBuilder();
    if (page > 1)            row.addComponents(new ButtonBuilder().setCustomId('lb_prev').setLabel('← Prev').setStyle(ButtonStyle.Secondary));
    if (page < totalPages)   row.addComponents(new ButtonBuilder().setCustomId('lb_next').setLabel('Next →').setStyle(ButtonStyle.Secondary));

    return { embed, components: row.components.length ? [row] : [], totalPages };
}

module.exports = { buildPage };
