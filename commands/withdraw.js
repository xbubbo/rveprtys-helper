const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to withdraw')
                .setRequired(true)
        ),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = await getUser(interaction.user.id, interaction.guild.id);


        if (amount <= 0) {
            return interaction.reply({
                content: "❌ Amount must be greater than 0.",
                ephemeral: true
            });
        }

        if (user.bank < amount) {
            return interaction.reply({
                content: "❌ You don't have enough money in your bank.",
                ephemeral: true
            });
        }


        user.bank -= amount;
        user.balance += amount;

        await user.save();

        const embed = new EmbedBuilder()
            .setTitle('🏦 Withdrawal Successful')
            .setDescription(`Withdrew **$${amount}** from your bank.`)
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [embed] });
    }
};
