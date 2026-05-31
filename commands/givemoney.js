const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give money to another user')
        .addUserOption(option =>
            option.setName('user').setDescription('Recipient').setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount').setDescription('Amount to give').setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot give money to yourself.', ephemeral: true });
        if (!amount || amount <= 0)             return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });

        const user     = await getUser(interaction.user.id, interaction.guild.id);
        const receiver = await getUser(target.id,           interaction.guild.id);

        if (user.balance < amount) return interaction.reply({ content: '❌ Not enough money.', ephemeral: true });

        user.balance     = parseFloat((user.balance     - amount).toFixed(2));
        receiver.balance = parseFloat((receiver.balance + amount).toFixed(2));
        await user.save();
        await receiver.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Transfer Complete')
            .setDescription(`You gave **$${fmt(amount)}** to <@${target.id}>`)
            .setColor(0x00ff00)] });
    }
};
