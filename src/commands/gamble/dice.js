const { EmbedBuilder } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { trackWin, applyBoost } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    const userRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll  = Math.floor(Math.random() * 6) + 1;
    let winnings = 0, text, color;

    if (userRoll > botRoll) {
        winnings = parseFloat((bet * 2).toFixed(2));
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${formatNumber(winnings)}**!`;
        color = 0x00ff00;
    } else if (userRoll === botRoll) {
        winnings = bet;
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
        color = 0xffff00;
    } else {
        text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${formatNumber(bet)}**.`;
        color = 0xff0000;
    }

    if (winnings > 0) ({ winnings, text } = applyBoost(user, winnings, text));
    user.balance = parseFloat((user.balance + winnings).toFixed(2));
    trackWin(user, winnings, bet);
    await user.save();
    await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎲 Dice Roll').setDescription(text).setColor(color)] });
}

module.exports = { execute };
