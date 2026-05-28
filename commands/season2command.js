const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = "1453078748080504996";

function formatTimeLeft(ms) {
    if (ms <= 0) return '00d 00h 00m 00s';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function buildSeasonEmbed(guild, endTime) {
    const msLeft = endTime - new Date();
    const unixTimestamp = Math.floor(endTime.getTime() / 1000);

    const cashWinners = await User.find({ guildId: guild.id })
        .sort({ balance: -1 })
        .limit(5);

    const bankWinners = await User.find({ guildId: guild.id })
        .sort({ bank: -1 })
        .limit(5);

    const cashDesc = cashWinners.length
        ? cashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.balance}`).join('\n')
        : 'No data.';

    const bankDesc = bankWinners.length
        ? bankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.bank}`).join('\n')
        : 'No data.';

    return new EmbedBuilder()
        .setTitle('🏆 Season 2 — Live Standings')
        .setDescription(
            `Season 2 ends <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n` +
            `⏰ **Time Remaining:** \`${formatTimeLeft(msLeft)}\`\n` +
            `> Leaderboard updates every 24 hours. Good luck!`
        )
        .setColor(0x00FF99)
        .addFields(
            { name: '💵 Cash Leaders', value: cashDesc, inline: true },
            { name: '🏦 Bank Leaders', value: bankDesc, inline: true }
        )
        .setFooter({ text: `NRG Economy • Season 2 • Last updated` })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('season2')
        .setDescription('Owner: Start the Season 2 countdown timer with live leaderboard'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
        }

        const endTime = new Date();
        endTime.setMonth(endTime.getMonth() + 1);

        const embed = await buildSeasonEmbed(interaction.guild, endTime);
        await interaction.reply({ embeds: [embed] });

        const dailyInterval = setInterval(async () => {
            const msLeft = endTime - new Date();

            if (msLeft <= 0) {
                clearInterval(dailyInterval);

                const finalCashWinners = await User.find({ guildId: interaction.guild.id })
                    .sort({ balance: -1 })
                    .limit(5);

                const finalBankWinners = await User.find({ guildId: interaction.guild.id })
                    .sort({ bank: -1 })
                    .limit(5);

                const finalCashDesc = finalCashWinners.length
                    ? finalCashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.balance}`).join('\n')
                    : 'No data.';

                const finalBankDesc = finalBankWinners.length
                    ? finalBankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.bank}`).join('\n')
                    : 'No data.';

                const endEmbed = new EmbedBuilder()
                    .setTitle('🎉 Season 2 Has Ended!')
                    .setDescription('The Season 2 economy has concluded. Here are the final standings!')
                    .setColor(0xFFD700)
                    .addFields(
                        { name: '💵 Final Cash Winners', value: finalCashDesc, inline: true },
                        { name: '🏦 Final Bank Winners', value: finalBankDesc, inline: true }
                    )
                    .setFooter({ text: 'NRG Economy • Season 2 Final Results' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [endEmbed] });
                return;
            }

            const updatedEmbed = await buildSeasonEmbed(interaction.guild, endTime);
            await interaction.editReply({ embeds: [updatedEmbed] });

        }, 86400000);
    }
};
