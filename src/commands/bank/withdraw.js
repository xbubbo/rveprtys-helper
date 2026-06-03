const { EmbedBuilder } = require('discord.js');
const { formatNumber, parseAmount } = require('../../utils/format');

const MAX_BALANCE = 999_999_999_999_999;

async function execute(interaction, user) {
    const amount = parseAmount(interaction.options.getString('amount'), user.bank);
    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Usage: `withdraw <amount|all>`', ephemeral: true });
    if (amount > MAX_BALANCE)         return interaction.reply({ content: '❌ Amount too large.', ephemeral: true });
    if (user.bank < amount)           return interaction.reply({ content: "❌ You don't have enough in your bank.", ephemeral: true });

    user.bank    = parseFloat((user.bank    - amount).toFixed(2));
    user.balance = parseFloat((user.balance + amount).toFixed(2));
    await user.save();

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setTitle('💸 Withdrawal Successful')
            .setDescription(`Moved **$${formatNumber(amount)}** into your wallet.`)
            .addFields({ name: '💵 New Wallet Balance', value: `$${formatNumber(user.balance)}`, inline: true })
            .setColor(0x00cc44)]
    });
}

module.exports = { execute };
