const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { shuffledDeck, showHand, baccaratTotal, trackWin, applyBoost, refundTimeout } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🎰 Baccarat').setDescription(`Bet: **$${formatNumber(bet)}**\n\nPlayer (2x) | Banker (1.95x) | Tie (9x)\n\nPlace your bet!`).setColor(0x2b2d31)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bac_player').setLabel('Player (2x)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bac_banker').setLabel('Banker (1.95x)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bac_tie').setLabel('Tie (9x)').setStyle(ButtonStyle.Success),
        )],
        fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

    collector.on('collect', async i => {
        const choice = i.customId.replace('bac_', '');
        const deck   = shuffledDeck();
        let pHand    = [deck.pop(), deck.pop()];
        let bHand    = [deck.pop(), deck.pop()];
        let pTotal   = baccaratTotal(pHand);
        let bTotal   = baccaratTotal(bHand);
        if (pTotal < 8 && bTotal < 8) {
            if (pTotal <= 5) pHand.push(deck.pop());
            if (bTotal <= 5) bHand.push(deck.pop());
            pTotal = baccaratTotal(pHand);
            bTotal = baccaratTotal(bHand);
        }
        const winner = pTotal > bTotal ? 'player' : bTotal > pTotal ? 'banker' : 'tie';
        let winnings = 0, bacLine;
        if (winner === 'tie' && choice !== 'tie') {
            winnings = bet;
            bacLine  = `It's a **tie**! Your bet is pushed back.`;
        } else if (choice === winner) {
            if (choice === 'player')  winnings = parseFloat((bet * 2).toFixed(2));
            else if (choice === 'banker') winnings = parseFloat((bet * 1.95).toFixed(2));
            else winnings = parseFloat((bet * 9).toFixed(2));
            bacLine = `You bet on **${choice}** and won **$${formatNumber(winnings)}**!`;
        } else {
            bacLine = `**${winner.charAt(0).toUpperCase() + winner.slice(1)}** wins. You lost **$${formatNumber(bet)}**.`;
        }
        ({ winnings, text: bacLine } = applyBoost(user, winnings, bacLine));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        await i.update({
            embeds: [new EmbedBuilder().setTitle('🎰 Baccarat')
                .setDescription(`**Player:** ${showHand(pHand)} = **${pTotal}**\n**Banker:** ${showHand(bHand)} = **${bTotal}**\n\n${bacLine}`)
                .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }, { name: '🎯 You Bet On', value: choice, inline: true })
                .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            await refundTimeout(user, bet);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎰 Baccarat').setDescription('You took too long. Bet refunded.').setColor(0xffff00)], components: [] }).catch(() => {});
        }
    });
}

module.exports = { execute };
