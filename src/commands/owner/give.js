const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    const user   = await getUser(target.id, interaction.guild.id);
    user.balance = parseFloat((user.balance + amount).toFixed(2));
    await user.save();
    return interaction.reply({ content: `✅ Gave **$${formatNumber(amount)}** to <@${target.id}>`, ephemeral: true });
}

module.exports = { execute };
