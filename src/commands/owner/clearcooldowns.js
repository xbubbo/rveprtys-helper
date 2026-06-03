const cooldowns = require('../../utils/cooldowns');

async function execute(interaction) {
    Object.values(cooldowns).forEach(m => m.clear());
    return interaction.reply({ content: '✅ All cooldowns cleared.', ephemeral: true });
}

module.exports = { execute };
