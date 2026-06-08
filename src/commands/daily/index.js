const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

const COOLDOWN     = 24 * 60 * 60 * 1000;
const BASE_REWARD  = 300;
const STREAK_BONUS = 35;
const STREAK_CAP   = 30;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id);
        const now  = Date.now();

        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastDaily);
            const h = Math.floor(left / 3600000);
            const m = Math.floor((left % 3600000) / 60000);
            const s = Math.floor((left % 60000) / 1000);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⏳ Already Claimed')
                    .setDescription(`You already claimed your daily today.\nCome back in **${h}h ${m}m ${s}s**.`)
                    .setColor(0x71717a)],
                ephemeral: true,
            });
        }

        const streak = user.dailyStreak && user.lastDaily && (now - user.lastDaily < 48 * 60 * 60 * 1000)
            ? user.dailyStreak + 1 : 1;

        const amount = BASE_REWARD + Math.min(streak - 1, STREAK_CAP) * STREAK_BONUS;

        user.lastDaily   = now;
        user.dailyStreak = streak;
        user.balance     = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        const streakDisplay = streak >= 7 ? `🔥 ${streak} days` : `${streak} day${streak !== 1 ? 's' : ''}`;

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🎁 Daily Reward')
                .addFields(
                    { name: '💵 Amount',      value: `$${formatNumber(amount)}`,       inline: true },
                    { name: '🔥 Streak',      value: streakDisplay,                    inline: true },
                    { name: '💰 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }
                )
                .setColor(0xFFD700)
                .setFooter({ text: streak >= 7 ? 'Hot streak! Keep it going!' : 'Come back tomorrow for a streak bonus!' })]
        });
    }
};
