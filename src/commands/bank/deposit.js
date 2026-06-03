const { EmbedBuilder } = require('discord.js');
const { formatNumber, parseAmount } = require('../../utils/format');

const MAX_BALANCE = 999_999_999_999_999;

async function execute(interaction, user) {
    const amount = parseAmount(interaction.options.getString('amount'), user.balance);
    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Usage: `deposit <amount|all>`', ephemeral: true });
    if (amount > MAX_BALANCE)         return interaction.reply({ content: '❌ Amount too large.', ephemeral: true });
    if (user.balance < amount)        return interaction.reply({ content: "❌ You don't have enough in your wallet.", ephemeral: true });

    user.balance = parseFloat((user.balance - amount).toFixed(2));
    user.bank    = parseFloat((user.bank    + amount).toFixed(2));
    await user.save();

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('🏦 Deposit Successful')
            .setDescription(`Moved **$${formatNumber(amount)}** into your bank.`)
            .addFields({ name: '🏦 New Bank Balance', value: `$${formatNumber(user.bank)}`, inline: true })
            .setColor(0x00cc44)]
    });
}

module.exports = { execute };
