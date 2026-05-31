const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

const COOLDOWN = 24 * 60 * 60 * 1000;
const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now  = Date.now();

        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastDaily);
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Daily Already Claimed')
                .setDescription(`Come back in **${h}h ${m}m ${s}s**.`)
                .setColor(0x2b2d31)], ephemeral: true });
        }

        const streak = user.dailyStreak && user.lastDaily && (now - user.lastDaily < 48 * 60 * 60 * 1000)
            ? user.dailyStreak + 1 : 1;
        const amount = 200 + Math.min(streak - 1, 30) * 25;

        user.lastDaily   = now;
        user.dailyStreak = streak;
        user.balance     = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Daily Reward')
            .setDescription('You claimed your daily reward!')
            .addFields(
                { name: 'Amount',      value: `$${fmtInt(amount)}`,                      inline: true },
                { name: 'Streak',      value: `${streak} day${streak !== 1 ? 's' : ''}`, inline: true },
                { name: 'New Balance', value: `$${fmt(user.balance)}`,                   inline: true }
            )
            .setColor(0xFFD700)
            .setFooter({ text: streak >= 7 ? 'Hot streak! Keep it going!' : 'Come back tomorrow for a streak bonus!' })] });
    }
};
