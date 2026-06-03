const User = require('../../models/user');

async function execute(interaction) {
    await User.updateMany({ guildId: interaction.guild.id }, { balance: 0, bank: 0 });
    return interaction.reply({ content: '✅ Economy reset for this server.', ephemeral: true });
}

module.exports = { execute };
