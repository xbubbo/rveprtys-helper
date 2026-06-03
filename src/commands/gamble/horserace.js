const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { HORSES, trackWin, applyBoost, refundTimeout } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    const horseList = HORSES.map(h => `${h.emoji} **${h.name}** - ${h.odds}x`).join('\n');
    const rows = [
        new ActionRowBuilder().addComponents(HORSES.slice(0, 3).map((h, i) => new ButtonBuilder().setCustomId(`horse_${i}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary))),
        new ActionRowBuilder().addComponents(HORSES.slice(3).map((h, i)   => new ButtonBuilder().setCustomId(`horse_${i + 3}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary))),
    ];

    const msg = await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription(`**Pick your horse:**\n\n${horseList}\n\nBet: **$${formatNumber(bet)}**`).setColor(0x2b2d31)],
        components: rows,
        fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

    collector.on('collect', async i => {
        const idx  = parseInt(i.customId.split('_')[1]);
        const pick = HORSES[idx];

        const weights  = HORSES.map(h => 1 / h.odds);
        const total    = weights.reduce((a, b) => a + b, 0);
        let r          = Math.random() * total;
        let winnerIdx  = HORSES.length - 1;
        for (let j = 0; j < weights.length; j++) { r -= weights[j]; if (r <= 0) { winnerIdx = j; break; } }
        const winner   = HORSES[winnerIdx];

        const raceLines = HORSES.map((h, j) => `${j === winnerIdx ? '🥇' : '   '} ${h.emoji} ${h.name}`).join('\n');

        let winnings = 0, resultText;
        if (winnerIdx === idx) {
            winnings   = parseFloat((bet * pick.odds).toFixed(2));
            resultText = `Your horse **${pick.name}** won! You won **$${formatNumber(winnings)}**!`;
        } else {
            resultText = `**${winner.name}** won the race. Your horse **${pick.name}** lost **$${formatNumber(bet)}**.`;
        }
        ({ winnings, text: resultText } = applyBoost(user, winnings, resultText));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        await i.update({
            embeds: [new EmbedBuilder().setTitle('🏇 Horse Race Results').setDescription(`${raceLines}\n\n${resultText}`).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(winnings > 0 ? 0x00ff00 : 0xff0000)],
            components: [],
        });
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            await refundTimeout(user, bet);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription('You took too long to pick a horse. Bet refunded.').setColor(0xffff00)], components: [] }).catch(() => {});
        }
    });
}

module.exports = { execute };
