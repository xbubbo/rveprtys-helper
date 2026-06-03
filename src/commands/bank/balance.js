const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

const PRESTIGE_BADGES = ['', '★', '★★', '★★★', '✦', '✦✦', '✦✦✦', '◆', '◆◆', '◆◆◆', '👑'];

async function execute(interaction, user) {
    const target     = interaction.options.getUser('user') ?? interaction.user;
    const targetUser = target.id === interaction.user.id ? user : await getUser(target.id, interaction.guild.id);

    const embed = new EmbedBuilder()
        .setTitle(`💰 ${target.username}'s Balance`)
        .addFields(
            { name: '💵 Wallet', value: `$${formatNumber(targetUser.balance)}`, inline: true },
            { name: '🏦 Bank',   value: `$${formatNumber(targetUser.bank)}`,    inline: true }
        )
        .setColor(0x2b2d31);

    if (targetUser.prestige > 0) {
        embed.addFields({
            name: 'Prestige',
            value: `${PRESTIGE_BADGES[targetUser.prestige]} Level ${targetUser.prestige} · ${targetUser.prestigeMultiplier}x multiplier`,
            inline: false,
        });
    }

    return interaction.reply({ embeds: [embed] });
}

module.exports = { execute };
