const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    if (!Number.isSafeInteger(amount) || amount < 0)
        return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });

    const user   = await getUser(target.id, interaction.guild.id);
    user.balance = amount;
    await user.save();
    return interaction.reply({ content: `✅ Set <@${target.id}>'s wallet to **$${formatNumber(amount)}**`, ephemeral: true });
}

module.exports = { execute };
