const User = require('../../models/user');

async function execute(interaction) {
    await User.updateMany({}, { balance: 0, bank: 0 });
    return interaction.reply({ content: '✅ Economy reset (global).', ephemeral: true });
}

module.exports = { execute };
