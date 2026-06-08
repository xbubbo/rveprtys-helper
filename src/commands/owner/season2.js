const { EmbedBuilder } = require('discord.js');
const User = require('../../models/user');

function formatTimeLeft(ms) {
    if (ms <= 0) return '00d 00h 00m 00s';
    const total   = Math.floor(ms / 1000);
    const days    = Math.floor(total / 86400);
    const hours   = String(Math.floor((total % 86400) / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function buildSeasonEmbed(guild, endTime) {
    const msLeft        = endTime - new Date();
    const unixTimestamp = Math.floor(endTime.getTime() / 1000);
    const cashWinners   = await User.find().sort({ balance: -1 }).limit(5);
    const bankWinners   = await User.find().sort({ bank: -1 }).limit(5);
    const cashDesc = cashWinners.length ? cashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.balance}`).join('\n') : 'No data.';
    const bankDesc = bankWinners.length ? bankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.bank}`).join('\n') : 'No data.';
    return new EmbedBuilder()
        .setTitle('Season 2 - Live Standings')
        .setDescription(`Season 2 ends <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\nTime Remaining: \`${formatTimeLeft(msLeft)}\`\nLeaderboard updates every 24 hours. Good luck!`)
        .setColor(0x00FF99)
        .addFields(
            { name: 'Cash Leaders', value: cashDesc, inline: true },
            { name: 'Bank Leaders', value: bankDesc, inline: true },
        )
        .setFooter({ text: 'NRG Economy - Season 2 - Last updated' })
        .setTimestamp();
}

async function execute(interaction) {
    const endTime = new Date();
    endTime.setMonth(endTime.getMonth() + 1);

    await interaction.reply({ embeds: [await buildSeasonEmbed(interaction.guild, endTime)] });

    const interval = setInterval(async () => {
        const msLeft = endTime - new Date();
        if (msLeft <= 0) {
            clearInterval(interval);
            const finalCash = await User.find().sort({ balance: -1 }).limit(5);
            const finalBank = await User.find().sort({ bank: -1 }).limit(5);
            const cashDesc  = finalCash.length ? finalCash.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.balance}`).join('\n') : 'No data.';
            const bankDesc  = finalBank.length ? finalBank.map((u, i) => `**${i + 1}.** <@${u.userId}> - $${u.bank}`).join('\n') : 'No data.';
            await interaction.editReply({ embeds: [new EmbedBuilder()
                .setTitle('🎉 Season 2 Has Ended!')
                .setDescription('The Season 2 economy has concluded. Here are the final standings!')
                .setColor(0xFFD700)
                .addFields(
                    { name: 'Final Cash Winners', value: cashDesc, inline: true },
                    { name: 'Final Bank Winners', value: bankDesc, inline: true },
                )
                .setTimestamp()] });
            return;
        }
        await interaction.editReply({ embeds: [await buildSeasonEmbed(interaction.guild, endTime)] });
    }, 86400000);
}

module.exports = { execute };
