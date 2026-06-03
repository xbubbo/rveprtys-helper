const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { pregame } = require('../../utils/pregame');
const { shuffledDeck, cardRank, trackWin } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    const { started, msg } = await pregame(interaction, user, bet, {
        title: '🃏 High / Low',
        getEmbed: () => new EmbedBuilder()
            .setTitle('🃏 High / Low')
            .setDescription(`Bet: **$${formatNumber(bet)}**\n\nA card will be dealt when you start. Guess higher or lower to multiply your bet.`)
            .setColor(0x2b2d31),
    });

    if (!started) return;

    const deck = shuffledDeck();
    let currentCard = deck.pop();
    let multiplier  = 1;

    const hlEmbed = (card, mult, extra = '') => new EmbedBuilder()
        .setTitle('🃏 High / Low')
        .setDescription(`Current card: \`${card.v}${card.s}\`\nMultiplier: **${mult.toFixed(2)}x** - Potential payout: **$${formatNumber(parseFloat((bet * mult).toFixed(2)))}**\n\n${extra || 'Will the next card be higher or lower?'}`)
        .setColor(0x2b2d31);

    const hlButtons = (mult) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hl_high').setLabel('Higher ▲').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hl_low').setLabel('Lower ▼').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('hl_cash').setLabel(`Cash Out ($${formatNumber(parseFloat((bet * mult).toFixed(2)))})`).setStyle(ButtonStyle.Secondary)
    );

    await msg.edit({ embeds: [hlEmbed(currentCard, multiplier)], components: [hlButtons(multiplier)] });

    const cashOut = async (i, mult, timedOut = false) => {
        let payout = parseFloat((bet * mult).toFixed(2));
        if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) payout = parseFloat((payout * 1.05).toFixed(2));
        user.balance = parseFloat((user.balance + payout).toFixed(2));
        trackWin(user, payout, bet);
        await user.save();
        const embed = new EmbedBuilder().setTitle('🃏 High / Low')
            .setDescription(timedOut ? `Timed out - auto cashed out at **${mult.toFixed(2)}x**!\nYou received **$${formatNumber(payout)}**.` : `Cashed out at **${mult.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`)
            .setColor(payout > bet ? 0x00ff00 : 0xffff00);
        if (i) await i.update({ embeds: [embed], components: [] });
        else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    };

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
    collector.on('collect', async i => {
        if (i.customId === 'hl_cash') { collector.stop('done'); await cashOut(i, multiplier); return; }
        const nextCard = deck.pop();
        const currRank = cardRank(currentCard);
        const nextRank = cardRank(nextCard);
        if (nextRank === currRank) {
            collector.stop('done'); trackWin(user, 0, bet); await user.save();
            await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Equal! You lost **$${formatNumber(bet)}**.`).setColor(0xff0000)], components: [] });
            return;
        }
        const correct = i.customId === 'hl_high' ? nextRank > currRank : nextRank < currRank;
        if (correct) {
            multiplier  = parseFloat((multiplier * 1.8).toFixed(2));
            currentCard = nextCard;
            await i.update({ embeds: [hlEmbed(currentCard, multiplier, `Correct! Keep going or cash out.`)], components: [hlButtons(multiplier)] });
        } else {
            collector.stop('done'); trackWin(user, 0, bet); await user.save();
            await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Wrong! You lost **$${formatNumber(bet)}**.`).setColor(0xff0000)], components: [] });
        }
    });
    collector.on('end', async (_, reason) => { if (reason !== 'done') await cashOut(null, multiplier, true); });
}

module.exports = { execute };
