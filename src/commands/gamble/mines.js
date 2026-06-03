const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { pregame, makeCancelStart } = require('../../utils/pregame');
const { trackWin, applyBoost } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    let gridSize  = 3;
    let mineCount = 3;
    const maxMines = () => gridSize * gridSize - 1;

    const getEmbed = () => new EmbedBuilder()
        .setTitle('💣 Mines')
        .setDescription(`Bet: **$${formatNumber(bet)}**\nGrid: **${gridSize}x${gridSize}** | Mines: **${mineCount}**\n\nReveal safe tiles to grow your multiplier.\nHit a mine and you lose everything.`)
        .setColor(0x2b2d31);

    const getOptionRows = () => [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mines_grid_3').setLabel('3x3').setStyle(gridSize === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('mines_grid_4').setLabel('4x4').setStyle(gridSize === 4 ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('mines_grid_5').setLabel('5x5').setStyle(gridSize === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mines_minus').setLabel('-').setStyle(ButtonStyle.Secondary).setDisabled(mineCount <= 1),
            new ButtonBuilder().setCustomId('mines_count').setLabel(`${mineCount} mine${mineCount !== 1 ? 's' : ''}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('mines_plus').setLabel('+').setStyle(ButtonStyle.Secondary).setDisabled(mineCount >= maxMines()),
        ),
    ];

    const { started, msg } = await pregame(interaction, user, bet, {
        title: '💣 Mines',
        getEmbed,
        getOptionRows,
        onOption: async (i) => {
            if (i.customId === 'mines_grid_3') { gridSize = 3; mineCount = Math.min(mineCount, maxMines()); }
            if (i.customId === 'mines_grid_4') { gridSize = 4; mineCount = Math.min(mineCount, maxMines()); }
            if (i.customId === 'mines_grid_5') gridSize = 5;
            if (i.customId === 'mines_minus' && mineCount > 1) mineCount--;
            if (i.customId === 'mines_plus' && mineCount < maxMines()) mineCount++;
            await i.update({ embeds: [getEmbed()], components: [...getOptionRows(), makeCancelStart()] });
        },
    });

    if (!started) return;

    const is5x5   = gridSize === 5;
    const total   = gridSize * gridSize;
    const mineSet = new Set();
    while (mineSet.size < mineCount) mineSet.add(Math.floor(Math.random() * total));

    const revealed = Array(total).fill(false);
    let safeReveals = 0;
    let multiplier  = 1.0;
    let gameOver    = false;

    const nextMultiplier = () => parseFloat((multiplier * 0.97 * (total - safeReveals) / (total - mineCount - safeReveals)).toFixed(4));

    const cashoutRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mine_cashout').setLabel(`Cash Out (${multiplier.toFixed(2)}x - $${formatNumber(parseFloat((bet * multiplier).toFixed(2)))})`).setStyle(ButtonStyle.Primary)
    );

    const buildGrid = (showMines = false) => {
        const rows = [];
        for (let r = 0; r < gridSize; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < gridSize; c++) {
                const idx = r * gridSize + c;
                const btn = new ButtonBuilder().setCustomId(`mine_${idx}`).setStyle(ButtonStyle.Secondary);
                if (revealed[idx]) {
                    mineSet.has(idx) ? btn.setEmoji('💣').setStyle(ButtonStyle.Danger).setDisabled(true) : btn.setEmoji('💎').setStyle(ButtonStyle.Success).setDisabled(true);
                } else if (showMines && mineSet.has(idx)) {
                    btn.setEmoji('💣').setStyle(ButtonStyle.Danger).setDisabled(true);
                } else {
                    btn.setEmoji('🟦').setDisabled(showMines || gameOver);
                }
                row.addComponents(btn);
            }
            rows.push(row);
        }
        if (!is5x5 && !showMines && !gameOver) rows.push(cashoutRow());
        return rows;
    };

    const minesEmbed = (state = 'playing') => {
        const payout = parseFloat((bet * multiplier).toFixed(2));
        if (state === 'playing') return new EmbedBuilder().setTitle('💣 Mines').setDescription(`**${multiplier.toFixed(2)}x** | **${safeReveals}** safe | **${mineCount}** mines hidden`).setColor(0x2ecc71);
        if (state === 'cashout') return new EmbedBuilder().setTitle('💣 Mines').setDescription(`Cashed out at **${multiplier.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(0x00ff00);
        if (state === 'boom')    return new EmbedBuilder().setTitle('💣 Mines').setDescription(`💥 You hit a mine! You lost **$${formatNumber(bet)}**.`).setColor(0xff0000);
        if (state === 'cleared') return new EmbedBuilder().setTitle('💣 Mines').setDescription(`🎉 Board cleared at **${multiplier.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(0xFFD700);
    };

    await msg.edit({ embeds: [minesEmbed()], components: buildGrid() });

    let cashoutMsg = null;
    if (is5x5) cashoutMsg = await interaction.followUp({ components: [cashoutRow()], fetchReply: true });

    const clearCashoutMsg = () => cashoutMsg?.edit({ components: [] }).catch(() => {});

    const gameCollector = msg.createMessageComponentCollector({ filter: j => j.user.id === interaction.user.id, time: 300000 });

    const doCashout = async (j = null, fromCashoutMsg = false) => {
        gameOver = true;
        gameCollector.stop('cashout');
        let payout = parseFloat((bet * multiplier).toFixed(2));
        let note   = '';
        ({ winnings: payout, text: note } = applyBoost(user, payout, note));
        user.balance = parseFloat((user.balance + payout).toFixed(2));
        trackWin(user, payout, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        const embed      = minesEmbed('cashout');
        const components = buildGrid(true);
        if (fromCashoutMsg && j) { await j.update({ components: [] }); await msg.edit({ embeds: [embed], components }).catch(() => {}); }
        else if (j) { await j.update({ embeds: [embed], components }); await clearCashoutMsg(); }
        else { await msg.edit({ embeds: [embed], components }).catch(() => {}); await clearCashoutMsg(); }
    };

    if (cashoutMsg) {
        const coCollector = cashoutMsg.createMessageComponentCollector({ filter: j => j.user.id === interaction.user.id, time: 300000 });
        coCollector.on('collect', async j => { if (gameOver) return; await doCashout(j, true); coCollector.stop(); });
    }

    gameCollector.on('collect', async j => {
        if (gameOver) return;
        if (j.customId === 'mine_cashout') { await doCashout(j); return; }
        if (!j.customId.startsWith('mine_')) return;
        const idx = parseInt(j.customId.split('_')[1]);
        if (revealed[idx]) return;
        revealed[idx] = true;

        if (mineSet.has(idx)) {
            gameOver = true; gameCollector.stop('boom');
            trackWin(user, 0, bet); await user.save();
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
            await clearCashoutMsg();
            await j.update({ embeds: [minesEmbed('boom')], components: buildGrid(true) });
            return;
        }

        multiplier = nextMultiplier();
        safeReveals++;

        if (safeReveals === total - mineCount) {
            gameOver = true; gameCollector.stop('cleared');
            let payout = parseFloat((bet * multiplier).toFixed(2)), note = '';
            ({ winnings: payout, text: note } = applyBoost(user, payout, note));
            user.balance = parseFloat((user.balance + payout).toFixed(2));
            trackWin(user, payout, bet); await user.save();
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
            await clearCashoutMsg();
            await j.update({ embeds: [minesEmbed('cleared')], components: buildGrid(true) });
            return;
        }

        await j.update({ embeds: [minesEmbed()], components: buildGrid() });
        if (is5x5) await cashoutMsg?.edit({ components: [cashoutRow()] }).catch(() => {});
    });

    gameCollector.on('end', async (_, reason) => { if (!gameOver) await doCashout(); });
}

module.exports = { execute };
