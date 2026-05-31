const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

const MAX_BALANCE = 999_999_999_999_999;
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseAmount(str, balance) {
    if (!str) return NaN;
    const s = str.toString().toLowerCase();
    if (s === 'all' || s === 'max') return balance;
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank')
        .addStringOption(option =>
            option.setName('amount').setDescription('Amount to withdraw, or "all"').setRequired(true)
        ),

    async execute(interaction) {
        const user   = await getUser(interaction.user.id, interaction.guild.id);
        const amount = parseAmount(interaction.options.getString('amount'), user.bank);

        if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Usage: `withdraw <amount|all>`', ephemeral: true });
        if (amount > MAX_BALANCE)          return interaction.reply({ content: '❌ Amount too large.', ephemeral: true });
        if (user.bank < amount)            return interaction.reply({ content: "❌ You don't have enough in your bank.", ephemeral: true });

        user.bank    = parseFloat((user.bank    - amount).toFixed(2));
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Withdrawal Successful')
            .setDescription(`Withdrew **$${fmt(amount)}** from your bank.`)
            .addFields({ name: 'New Wallet Balance', value: `$${fmt(user.balance)}`, inline: true })
            .setColor(0x00ff00)] });
    }
};
