const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const Portfolio = require('../../models/portfolio');
const Slave = require('../../models/slave');

const REQUIRED     = 1_000_000;
const MAX_PRESTIGE = 10;

const PRESTIGE_BADGES = ['', '★', '★★', '★★★', '✦', '✦✦', '✦✦✦', '◆', '◆◆', '◆◆◆', '👑'];
const PRESTIGE_COLORS = [
    0x2b2d31, 0xcd7f32, 0xc0c0c0, 0xFFD700, 0x00FF99,
    0x00ccff, 0xff66ff, 0xff4444, 0xff8800, 0xffffff, 0xFFD700,
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestige')
        .setDescription('Reset everything and ascend to the next prestige level for a permanent earn multiplier'),

    async execute(interaction) {
        const user        = await getUser(interaction.user.id);
        const totalWealth = user.balance + user.bank;

        if (user.prestige >= MAX_PRESTIGE) {
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${PRESTIGE_BADGES[MAX_PRESTIGE]} Max Prestige Reached`)
                .setDescription('You have reached the maximum prestige level. You are a legend.')
                .setColor(PRESTIGE_COLORS[MAX_PRESTIGE])] });
        }

        if (totalWealth < REQUIRED) {
            const needed = REQUIRED - totalWealth;
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Prestige')
                .setDescription(
                    `You need a total wealth of **$1,000,000** to prestige.\n\n` +
                    `Your current wealth: **$${totalWealth.toLocaleString()}**\n` +
                    `You still need **$${needed.toLocaleString()}** more.`
                )
                .setColor(0x2b2d31)] });
        }

        const nextPrestige  = user.prestige + 1;
        const newMultiplier = parseFloat((1 + nextPrestige * 0.25).toFixed(2));
        const badge         = PRESTIGE_BADGES[nextPrestige];

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Prestige Confirmation')
            .setDescription(
                `Are you sure you want to prestige?\n\n` +
                `**This will reset:**\n> Wallet, bank, stocks, and slave status\n\n` +
                `**You will receive:**\n` +
                `> Prestige ${nextPrestige} ${badge}\n` +
                `> **${newMultiplier}x** earn multiplier on \`?work\` and \`?daily\`\n\n` +
                `Type \`confirm\` within 30 seconds to proceed.`
            )
            .setColor(PRESTIGE_COLORS[nextPrestige])] });

        const confirmed = await new Promise(resolve => {
            const collector = interaction.channel.createMessageCollector({
                filter: m => m.author.id === interaction.user.id && m.content.toLowerCase() === 'confirm' && m.channel.id === interaction.channel.id,
                time: 30000, max: 1,
            });
            collector.on('collect', () => resolve(true));
            collector.on('end', (_, reason) => { if (reason === 'time') resolve(false); });
        });

        if (!confirmed) {
            return interaction.followUp({ embeds: [new EmbedBuilder()
                .setDescription('Prestige cancelled - confirmation timed out.')
                .setColor(0x2b2d31)] });
        }

        user.balance           = 0;
        user.bank              = 0;
        user.prestige          = nextPrestige;
        user.prestigeMultiplier = newMultiplier;
        user.dailyStreak       = 0;
        await user.save();

        await Portfolio.findOneAndUpdate({ userId: interaction.user.id }, { holdings: [] });
        await Slave.updateMany({ userId: interaction.user.id }, { ownerId: null, debt: 0, totalEarned: 0 });
        await Slave.updateMany({ ownerId: interaction.user.id }, { ownerId: null, debt: 0, totalEarned: 0 });

        return interaction.followUp({ embeds: [new EmbedBuilder()
            .setTitle(`${badge} Prestige ${nextPrestige} Achieved!`)
            .setDescription(
                `You have ascended to **Prestige ${nextPrestige}**.\n\n` +
                `Everything has been reset. Time to grind again.\n\n` +
                `**Your multiplier:** ${newMultiplier}x - all \`?work\` and \`?daily\` earnings are boosted.`
            )
            .setColor(PRESTIGE_COLORS[nextPrestige])
            .setFooter({ text: `Prestige ${nextPrestige}/${MAX_PRESTIGE}` })] });
    }
};
