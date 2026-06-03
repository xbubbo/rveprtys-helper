const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { RED_NUMS, trackWin, applyBoost, refundTimeout } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription(`Bet: **$${formatNumber(bet)}**\n\n🔴 Red (2x) | ⚫ Black (2x) | 🟢 Green / 0 (35x)\n\nPlace your bet!`).setColor(0x2b2d31)],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rl_red').setLabel('Red').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('rl_black').setLabel('Black').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rl_green').setLabel('Green (0)').setStyle(ButtonStyle.Success),
        )],
        fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

    collector.on('collect', async i => {
        const pick      = i.customId === 'rl_red' ? 'red' : i.customId === 'rl_black' ? 'black' : 'green';
        const spin      = Math.floor(Math.random() * 37);
        const spinColor = spin === 0 ? 'green' : RED_NUMS.has(spin) ? 'red' : 'black';
        const emoji     = { red: '🔴', black: '⚫', green: '🟢' }[spinColor];
        let winnings = 0, text;
        if (pick === spinColor) {
            winnings = pick === 'green' ? parseFloat((bet * 35).toFixed(2)) : parseFloat((bet * 2).toFixed(2));
            text = `${emoji} **${spin}**\nYou bet **${pick}** - You won **$${formatNumber(winnings)}**!`;
        } else {
            text = `${emoji} **${spin}**\nYou bet **${pick}** - You lost **$${formatNumber(bet)}**.`;
        }
        ({ winnings, text } = applyBoost(user, winnings, text));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        await i.update({
            embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription(text).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(winnings ? 0x00ff00 : 0xff0000)],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            await refundTimeout(user, bet);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription('You took too long. Bet refunded.').setColor(0xffff00)], components: [] }).catch(() => {});
        }
    });
}

module.exports = { execute };
