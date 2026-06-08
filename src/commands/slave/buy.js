const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const Slave = require('../../models/slave');
const activeAuctions = require('../../utils/activeAuctions');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const target = interaction.options.getUser('user');
    if (target.id === interaction.user.id) return interaction.reply({ content: "❌ You can't buy yourself.", ephemeral: true });
    if (target.bot)                         return interaction.reply({ content: "❌ You can't buy a bot.", ephemeral: true });

    const buyer         = await getUser(interaction.user.id);
    const targetEcon    = await getUser(target.id);
    const existingSlave = await Slave.findOne({ userId: target.id });
    if (existingSlave?.ownerId)
        return interaction.reply({ content: `❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`, ephemeral: true });

    const auctionKey = `${interaction.guild.id}-${target.id}`;
    if (activeAuctions.has(auctionKey))
        return interaction.reply({ content: `❌ There is already an active auction for <@${target.id}>.`, ephemeral: true });

    const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
    if (buyPrice <= 0)           return interaction.reply({ content: '❌ This person has no balance to determine a price.', ephemeral: true });
    if (buyer.balance < buyPrice) return interaction.reply({ content: `❌ You need **$${formatNumber(buyPrice)}** but only have **$${formatNumber(buyer.balance)}**.`, ephemeral: true });

    activeAuctions.set(auctionKey, {
        type: 'buy', slaveId: target.id, sellerId: null,
        currentBidderId: interaction.user.id, currentBid: buyPrice,
        channelId: interaction.channel.id, endsAt: Date.now() + 120000,
    });

    await interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('🔨 Auction Started!')
        .setDescription(
            `<@${interaction.user.id}> wants to buy <@${target.id}> for **$${formatNumber(buyPrice)}**!\n\n` +
            `<@${target.id}> you have **2 minutes** to escape by using \`/slave outbid\` with more than **$${formatNumber(buyPrice)}**.`
        )
        .setColor(0xFF4500).setTimestamp()] });

    setTimeout(async () => {
        const current = activeAuctions.get(auctionKey);
        if (!current) return;
        activeAuctions.delete(auctionKey);

        const freshBuyer = await getUser(current.currentBidderId);
        freshBuyer.balance = parseFloat((freshBuyer.balance - current.currentBid).toFixed(2));
        await freshBuyer.save();

        let slave = await Slave.findOne({ userId: target.id });
        if (!slave) slave = new Slave({ userId: target.id });
        slave.ownerId     = current.currentBidderId;
        slave.debt        = parseFloat((current.currentBid * 2).toFixed(2));
        slave.totalEarned = 0;
        await slave.save();

        const ch = await interaction.client.channels.fetch(current.channelId).catch(() => null);
        if (ch) await ch.send({ embeds: [new EmbedBuilder()
            .setTitle('⛓️ Purchase Complete!')
            .setDescription(`<@${current.currentBidderId}> bought <@${target.id}> for **$${formatNumber(current.currentBid)}**!\n<@${target.id}> must earn **$${formatNumber(slave.debt)}** to be free.`)
            .setColor(0xFF0000).setTimestamp()] });

        try {
            await target.send({ embeds: [new EmbedBuilder()
                .setTitle('You Have Been Bought!')
                .setDescription(`<@${current.currentBidderId}> purchased you for **$${formatNumber(current.currentBid)}**. You must earn **$${formatNumber(slave.debt)}** to be free.`)
                .setColor(0xFF0000)] });
        } catch {}
    }, 120000);
}

module.exports = { execute };
