const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const Portfolio = require('../models/portfolio');
const Stock = require('../models/stock');
const Slave = require('../models/slave');
const User = require('../models/user');

const PRESTIGE_BADGES = ['', '★', '★★', '★★★', '✦', '✦✦', '✦✦✦', '◆', '◆◆', '◆◆◆', '👑'];
const PRESTIGE_COLORS = [
    0x2b2d31, 0xcd7f32, 0xc0c0c0, 0xFFD700, 0x00FF99,
    0x00ccff, 0xff66ff, 0xff4444, 0xff8800, 0xffffff, 0xFFD700
];

const JOBS = [
    { id: 'intern',             title: 'Intern'             },
    { id: 'greeting_person',    title: 'Greeting Person'    },
    { id: 'low_level_employee', title: 'Low Level Employee' },
    { id: 'head_of_low_level',  title: 'Head of Low Level'  },
    { id: 'mid_level_employee', title: 'Mid Level Employee' },
    { id: 'head_of_mid_level',  title: 'Head of Mid Level'  },
    { id: 'executive',          title: 'Executive'          },
    { id: 'head_of_hr',         title: 'Head of HR'         },
    { id: 'board_of_directors', title: 'Board of Directors' },
];

function getJobTitle(id) {
    return JOBS.find(j => j.id === id)?.title || 'Unemployed';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription("View your profile or another player's")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User to view (default: yourself)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const user = await getUser(target.id);

        const netWorth = user.balance + user.bank;
        const prestige = user.prestige || 0;
        const prestigeBadge = prestige > 0 ? `${PRESTIGE_BADGES[prestige]} Prestige ${prestige}` : 'None';
        const jobTitle = getJobTitle(user.jobId);
        const totalMult = parseFloat(((user.prestigeMultiplier || 1) * (user.jobMultiplier || 1)).toFixed(2));

        const allUsers = await User.find({}).sort({ balance: -1 });
        const rankByWallet = allUsers.findIndex(u => u.userId === target.id) + 1;
        const sortedByNet = [...allUsers].sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
        const rankByNet = sortedByNet.findIndex(u => u.userId === target.id) + 1;

        let portfolioValue = 0;
        const portfolio = await Portfolio.findOne({ userId: target.id });
        if (portfolio?.holdings?.length) {
            for (const h of portfolio.holdings) {
                const stock = await Stock.findOne({ ticker: h.ticker });
                if (stock) portfolioValue += stock.price * h.shares;
            }
        }
        portfolioValue = parseFloat(portfolioValue.toFixed(2));

        const slave = await Slave.findOne({ userId: target.id });
        const slaveStatus = slave?.ownerId
            ? `Enslaved by <@${slave.ownerId}>`
            : 'Free';

        const ownedSlaves = await Slave.countDocuments({ ownerId: target.id });

        const discordUser = await interaction.client.users.fetch(target.id);
        const memberJoined = interaction.guild.members.cache.get(target.id)?.joinedAt;

        const color = PRESTIGE_COLORS[prestige] || 0x2b2d31;

        const embed = new EmbedBuilder()
            .setTitle(`${discordUser.username}'s Profile`)
            .setThumbnail(discordUser.displayAvatarURL({ dynamic: true }))
            .setColor(color)
            .addFields(
                { name: 'Wallet',          value: `$${formatNumber(user.balance)}`,   inline: true },
                { name: 'Bank',            value: `$${formatNumber(user.bank)}`,       inline: true },
                { name: 'Net Worth',       value: `$${formatNumber(netWorth)}`,        inline: true },
                { name: 'Portfolio',       value: `$${formatNumber(portfolioValue)}`,  inline: true },
                { name: 'Total Wealth',    value: `$${formatNumber(netWorth + portfolioValue)}`, inline: true },
                { name: '\u200b',          value: '\u200b',                            inline: true },
                { name: 'Job',             value: jobTitle,                            inline: true },
                { name: 'Work Multiplier', value: `x${totalMult}`,                    inline: true },
                { name: 'Prestige',        value: prestigeBadge,                      inline: true },
                { name: 'Server Rank',     value: `#${rankByWallet} (wallet)\n#${rankByNet} (net worth)`, inline: true },
                { name: 'Slave Status',    value: slaveStatus,                        inline: true },
                { name: 'Slaves Owned',    value: `${ownedSlaves}`,                   inline: true }
            )
            .setFooter({ text: `${interaction.guild.name} • Economic Bomb` });

        if (memberJoined) {
            embed.setTimestamp(memberJoined);
        }

        return interaction.reply({ embeds: [embed] });
    }
};
