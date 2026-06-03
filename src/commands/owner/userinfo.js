const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const target = interaction.options.getUser('user');
    const user   = await getUser(target.id, interaction.guild.id);
    return interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('👤 User Info')
        .addFields(
            { name: 'Wallet', value: `$${formatNumber(user.balance)}`, inline: true },
            { name: 'Bank',   value: `$${formatNumber(user.bank)}`,    inline: true },
        )
        .setColor(0x2b2d31)] });
}

module.exports = { execute };
