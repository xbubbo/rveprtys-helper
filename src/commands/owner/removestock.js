const Portfolio = require('../../models/portfolio');

async function execute(interaction) {
    const target    = interaction.options.getUser('user');
    const ticker    = interaction.options.getString('ticker').toUpperCase();
    const portfolio = await Portfolio.findOne({ userId: target.id, guildId: interaction.guild.id });
    if (!portfolio) return interaction.reply({ content: '❌ User has no portfolio.', ephemeral: true });

    const before = portfolio.holdings.length;
    portfolio.holdings = portfolio.holdings.filter(h => h.ticker !== ticker);
    if (portfolio.holdings.length === before)
        return interaction.reply({ content: `❌ <@${target.id}> doesn't hold \`${ticker}\`.`, ephemeral: true });

    await portfolio.save();
    return interaction.reply({ content: `✅ Removed all \`${ticker}\` shares from <@${target.id}>'s portfolio.`, ephemeral: true });
}

module.exports = { execute };
