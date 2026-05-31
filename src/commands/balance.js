const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Balance`)
            .addFields(
                { name: 'Wallet', value: `$${fmt(user.balance)}`, inline: true },
                { name: 'Bank',   value: `$${fmt(user.bank)}`,    inline: true }
            )
            .setColor(0x2b2d31)] });
    }
};
