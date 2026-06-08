const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const Slave = require('../../models/slave');
const activeAuctions = require('../../utils/activeAuctions');
const { formatNumber } = require('../../utils/format');

async function execute(interaction) {
    const target      = interaction.options.getUser('user');
    const startingBid = interaction.options.getInteger('startingbid');
    if (!startingBid || startingBid <= 0)
        return interaction.reply({ content: '❌ Starting bid must be greater than 0.', ephemeral: true });

    const slave = await Slave.findOne({ userId: target.id });
    if (!slave || slave.ownerId !== interaction.user.id)
        return interaction.reply({ content: `❌ You don't own <@${target.id}>.`, ephemeral: true });

    const auctionKey = `${interaction.guild.id}-${target.id}`;
    if (activeAuctions.has(auctionKey))
        return interaction.reply({ content: `❌ There is already an active auction for <@${target.id}>.`, ephemeral: true });

    activeAuctions.set(auctionKey, {
        type: 'sell', slaveId: target.id, sellerId: interaction.user.id,
        currentBidderId: null, currentBid: startingBid,
        channelId: interaction.channel.id, endsAt: Date.now() + 120000,
    });

    await interaction.reply({ embeds: [new EmbedBuilder()
        .setTitle('🔨 Slave Auction!')
        .setDescription(
            `<@${interaction.user.id}> is selling <@${target.id}>!\n\n` +
            `**Starting bid:** $${formatNumber(startingBid)}\n` +
            `Use \`/slave outbid <amount>\` to place a bid. Auction ends in **2 minutes**.`
        )
        .setColor(0xFF4500).setTimestamp()] });

    setTimeout(async () => {
        const current = activeAuctions.get(auctionKey);
        if (!current) return;
        activeAuctions.delete(auctionKey);

        const ch = await interaction.client.channels.fetch(current.channelId).catch(() => null);

        if (!current.currentBidderId) {
            if (ch) await ch.send({ embeds: [new EmbedBuilder()
                .setTitle('❌ Auction Ended')
                .setDescription(`No one bid on <@${current.slaveId}>. They stay with <@${current.sellerId}>.`)
                .setColor(0x71717a)] });
            return;
        }

        const winner = await getUser(current.currentBidderId);
        winner.balance = parseFloat((winner.balance - current.currentBid).toFixed(2));
        await winner.save();

        const seller = await getUser(current.sellerId);
        seller.balance = parseFloat((seller.balance + current.currentBid).toFixed(2));
        await seller.save();

        slave.ownerId     = current.currentBidderId;
        slave.debt        = parseFloat((current.currentBid * 2).toFixed(2));
        slave.totalEarned = 0;
        await slave.save();

        if (ch) await ch.send({ embeds: [new EmbedBuilder()
            .setTitle('⛓️ Auction Complete!')
            .setDescription(
                `<@${current.currentBidderId}> won the auction for <@${current.slaveId}> with **$${formatNumber(current.currentBid)}**!\n` +
                `<@${current.sellerId}> received **$${formatNumber(current.currentBid)}**.\n` +
                `<@${current.slaveId}> must earn **$${formatNumber(slave.debt)}** to be free.`
            )
            .setColor(0xFF0000).setTimestamp()] });

        try {
            const slaveUser = await interaction.client.users.fetch(current.slaveId);
            await slaveUser.send({ embeds: [new EmbedBuilder()
                .setTitle('You Have Been Sold!')
                .setDescription(`<@${current.sellerId}> sold you to <@${current.currentBidderId}> for **$${formatNumber(current.currentBid)}**. You must earn **$${formatNumber(slave.debt)}** to be free.`)
                .setColor(0xFF0000)] });
        } catch {}
    }, 120000);
}

module.exports = { execute };
