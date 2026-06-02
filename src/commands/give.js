const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber, parseAmount } = require('../utils/format');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give money to another user')
        .addUserOption(option =>
            option.setName('user').setDescription('Recipient').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount').setDescription('Amount, or: all, half, 10k, 50%').setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');

        if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot give money to yourself.', ephemeral: true });
        if (target.bot) return interaction.reply({ content: '❌ You cannot give money to a bot.', ephemeral: true });

        const user     = await getUser(interaction.user.id, interaction.guild.id);
        const receiver = await getUser(target.id, interaction.guild.id);

        const amount = parseAmount(interaction.options.getString('amount'), user.balance);
        if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });
        if (user.balance < amount) return interaction.reply({ content: '❌ Not enough money.', ephemeral: true });

        user.balance     = parseFloat((user.balance - amount).toFixed(2));
        receiver.balance = parseFloat((receiver.balance + amount).toFixed(2));
        await user.save();
        await receiver.save();

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🤝 Transfer Complete')
                .setDescription(`**$${formatNumber(amount)}** sent to <@${target.id}>`)
                .addFields(
                    { name: '💵 Your Balance', value: `$${formatNumber(user.balance)}`, inline: true }
                )
                .setColor(0x00cc44)]
        });
    }
};
