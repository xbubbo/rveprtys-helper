const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { shuffledDeck, handTotal, showHand, trackWin } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    const deck = shuffledDeck();
    let playerHand   = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    if (handTotal(playerHand) === 21 || handTotal(dealerHand) === 21) {
        const pBJ = handTotal(playerHand) === 21, dBJ = handTotal(dealerHand) === 21;
        let winnings = 0, result;
        if (pBJ && dBJ) { winnings = bet;                                result = `Both Blackjack - Push, bet refunded.`; }
        else if (pBJ)   { winnings = parseFloat((bet * 2.5).toFixed(2)); result = `Blackjack! You won **$${formatNumber(winnings)}**!`; }
        else            {                                                  result = `Dealer Blackjack. You lost **$${formatNumber(bet)}**.`; }
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🃏 Blackjack').setDescription(`Your hand: ${showHand(playerHand)} = **${handTotal(playerHand)}**\nDealer: ${showHand(dealerHand)} = **${handTotal(dealerHand)}**\n\n${result}`).setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)] });
    }

    await user.save();

    const bjEmbed = (pHand, extra = '') => new EmbedBuilder()
        .setTitle('🃏 Blackjack')
        .setDescription(`Your hand: ${showHand(pHand)} = **${handTotal(pHand)}**\nDealer shows: \`${dealerHand[0].v}${dealerHand[0].s}\` + ?\n\n${extra || 'Hit or Stand?'}`)
        .setColor(0x2b2d31);

    const bjButtons = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ embeds: [bjEmbed(playerHand)], components: [bjButtons()], fetchReply: true });

    const finish = async (i, pHand) => {
        let dHand = [...dealerHand];
        while (handTotal(dHand) < 17) dHand.push(deck.pop());
        const pVal = handTotal(pHand), dVal = handTotal(dHand);
        let winnings = 0, result;
        if (pVal > 21)        { result = `Bust! You lost **$${formatNumber(bet)}**.`; }
        else if (dVal > 21)   { winnings = parseFloat((bet * 2).toFixed(2)); result = `Dealer busts! You won **$${formatNumber(winnings)}**!`; }
        else if (pVal > dVal) { winnings = parseFloat((bet * 2).toFixed(2)); result = `You win! You won **$${formatNumber(winnings)}**!`; }
        else if (pVal < dVal) { result = `Dealer wins. You lost **$${formatNumber(bet)}**.`; }
        else                  { winnings = bet; result = `Push - bet refunded.`; }
        if ((user.gamblingBoostExpires ?? 0) > Date.now() && winnings > bet) { winnings = parseFloat((winnings * 1.05).toFixed(2)); result += ' 🛟 *+5%*'; }
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        const embed = new EmbedBuilder().setTitle('🃏 Blackjack').setDescription(`Your hand: ${showHand(pHand)} = **${pVal}**\nDealer: ${showHand(dHand)} = **${dVal}**\n\n${result}`).setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000);
        if (i) await i.update({ embeds: [embed], components: [] });
        else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    };

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
    collector.on('collect', async i => {
        if (i.customId === 'bj_hit') {
            playerHand.push(deck.pop());
            if (handTotal(playerHand) >= 21) { collector.stop('done'); await finish(i, playerHand); }
            else await i.update({ embeds: [bjEmbed(playerHand)], components: [bjButtons()] });
        } else {
            collector.stop('done');
            await finish(i, playerHand);
        }
    });
    collector.on('end', async (_, reason) => { if (reason !== 'done') await finish(null, playerHand); });
}

module.exports = { execute };
