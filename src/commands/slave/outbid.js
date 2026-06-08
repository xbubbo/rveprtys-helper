const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const activeAuctions = require('../../utils/activeAuctions');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const amount = interaction.options.getNumber('amount');
    if (!amount || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });

    const guildAuctions = [...activeAuctions.entries()].filter(([k]) => k.startsWith(interaction.guild.id));
    if (!guildAuctions.length) return interaction.reply({ content: '❌ No active auctions in this server.', ephemeral: true });

    const bidder = await getUser(interaction.user.id);

    for (const [auctionKey, auction] of guildAuctions) {
        if (auction.type === 'buy') {
            if (interaction.user.id !== auction.slaveId) continue;
            if (amount <= auction.currentBid)
                return interaction.reply({ content: `❌ You need more than **$${formatNumber(auction.currentBid)}**.`, ephemeral: true });
            if (bidder.balance < amount)
                return interaction.reply({ content: `❌ You don't have **$${formatNumber(amount)}**.`, ephemeral: true });
            activeAuctions.delete(auctionKey);
            bidder.balance = parseFloat((bidder.balance - amount).toFixed(2));
            await bidder.save();
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('🛡️ Purchase Blocked!')
                .setDescription(`<@${interaction.user.id}> paid **$${formatNumber(amount)}** and avoided being bought! Remaining: **$${formatNumber(bidder.balance)}**`)
                .setColor(0x00FF99)] });
        }

        if (auction.type === 'sell') {
            if (interaction.user.id === auction.sellerId)
                return interaction.reply({ content: "❌ You can't bid on your own auction.", ephemeral: true });
            if (interaction.user.id === auction.slaveId)
                return interaction.reply({ content: "❌ You can't bid to buy yourself.", ephemeral: true });
            if (amount <= auction.currentBid)
                return interaction.reply({ content: `❌ Must bid more than **$${formatNumber(auction.currentBid)}**.`, ephemeral: true });
            if (bidder.balance < amount)
                return interaction.reply({ content: `❌ You don't have **$${formatNumber(amount)}**.`, ephemeral: true });
            auction.currentBid      = amount;
            auction.currentBidderId = interaction.user.id;
            activeAuctions.set(auctionKey, auction);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('💰 Bid Placed!')
                .setDescription(`<@${interaction.user.id}> is now the highest bidder at **$${formatNumber(amount)}** for <@${auction.slaveId}>!`)
                .setColor(0x00FF99)] });
        }
    }

    return interaction.reply({ content: '❌ No active auctions you can bid on.', ephemeral: true });
}

module.exports = { execute };
