const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { trackWin, applyBoost, refundTimeout } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription(`Bet: **$${formatNumber(bet)}**\n\nPick a side!`).setColor(0x2b2d31)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cf_heads').setLabel('Heads').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cf_tails').setLabel('Tails').setStyle(ButtonStyle.Secondary),
        )],
        fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

    collector.on('collect', async i => {
        const pick   = i.customId === 'cf_heads' ? 'heads' : 'tails';
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        let winnings = 0, text;
        if (pick === result) {
            winnings = parseFloat((bet * 2).toFixed(2));
            text = `Coin landed on **${result}**\nYou won **$${formatNumber(winnings)}**!`;
        } else {
            text = `Coin landed on **${result}**\nYou lost **$${formatNumber(bet)}**.`;
        }
        ({ winnings, text } = applyBoost(user, winnings, text));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        await i.update({
            embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription(text).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(winnings ? 0x00ff00 : 0xff0000)],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            await refundTimeout(user, bet);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription('You took too long. Bet refunded.').setColor(0xffff00)], components: [] }).catch(() => {});
        }
    });
}

module.exports = { execute };
