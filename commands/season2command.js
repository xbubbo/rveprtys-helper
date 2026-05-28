const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const OWNER_ID = "1453078748080504996";

function getToday7PMCDT() {
    const now = new Date();
    const reset = new Date();
    reset.setUTCHours(0, 0, 0, 0);
    return reset;
}

function formatTimeLeft(ms) {
    if (ms <= 0) return '00h 00m 00s';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}h ${minutes}m ${seconds}s`;
}

function buildAnnouncementEmbed(timeLeft, unixTimestamp) {
    return new EmbedBuilder()
        .setTitle('⏳ Season 1 Economy Ending Soon!')
        .setDescription(
            `The **Season 1 Economy** will come to an end and reset at **7:00 PM CDT**.\n\n` +
            `⏰ **Time Remaining:** \`${timeLeft}\`\n` +
            `📅 **Reset At:** <t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)\n\n` +
            `> The economy will be wiped and **Season 2** will begin. Make sure to spend your money!`
        )
        .setColor(0xFF4500)
        .setFooter({ text: 'NRG Economy • Season 1 → Season 2' })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seasonreset')
        .setDescription('Owner: Start the Season 2 economy reset timer and announce the Season 1 winners'),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
        }

        const resetTime = getToday7PMCDT();
        const unixTimestamp = Math.floor(resetTime.getTime() / 1000);

        const cashWinners = await User.find({ guildId: interaction.guild.id })
            .sort({ balance: -1 })
            .limit(5);

        const bankWinners = await User.find({ guildId: interaction.guild.id })
            .sort({ bank: -1 })
            .limit(5);

        const cashDesc = cashWinners.length
            ? cashWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.balance}`).join('\n')
            : 'No data.';

        const bankDesc = bankWinners.length
            ? bankWinners.map((u, i) => `**${i + 1}.** <@${u.userId}> — $${u.bank}`).join('\n')
            : 'No data.';

        const winnersEmbed = new EmbedBuilder()
            .setTitle('🏆 Season 1 Final Leaderboard')
            .setColor(0xFFD700)
            .addFields(
                { name: '💵 Cash Leaderboard', value: cashDesc, inline: true },
                { name: '🏦 Bank Leaderboard', value: bankDesc, inline: true }
            )
            .setFooter({ text: 'These are the final Season 1 standings before the reset.' })
            .setTimestamp();

        const now = new Date();
        const initialMs = resetTime - now;

        await interaction.reply({
            embeds: [buildAnnouncementEmbed(formatTimeLeft(initialMs), unixTimestamp), winnersEmbed]
        });

        const interval = setInterval(async () => {
            const msLeft = resetTime - new Date();

            if (msLeft <= 0) {
                clearInterval(interval);

                await User.updateMany({}, { balance: 0, bank: 0 });

                const resetEmbed = new EmbedBuilder()
                    .setTitle('🔄 Season 2 Has Begun!')
                    .setDescription(
                        `The **Season 1 Economy** has been wiped.\n\n` +
                        `💰 All balances and bank accounts have been reset to **$0**.\n` +
                        `🚀 **Season 2** is now live! Good luck everyone!`
                    )
                    .setColor(0x00FF99)
                    .setFooter({ text: 'NRG Economy • Season 2 Start' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [resetEmbed] });
                return;
            }

            await interaction.editReply({
                embeds: [buildAnnouncementEmbed(formatTimeLeft(msLeft), unixTimestamp), winnersEmbed]
            });

        }, 1000);
    }
};
