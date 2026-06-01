const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');
const Slave = require('../models/slave');
const activeAuctions = require('../utils/activeAuctions');

const { formatNumber } = require('../utils/format');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slave')
        .setDescription('Slave system commands')
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Start an auction to purchase a user as a slave')
                .addUserOption(o => o.setName('user').setDescription('User to buy').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Auction off one of your slaves to the highest bidder')
                .addUserOption(o => o.setName('user').setDescription('Slave to sell').setRequired(true))
                .addIntegerOption(o => o.setName('startingbid').setDescription('Starting bid amount').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('outbid')
                .setDescription('Bid in an active sell auction, or pay to escape a buy auction')
                .addNumberOption(o => o.setName('amount').setDescription('Amount to bid').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Check your current slave status')
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Manage the users you own')
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View the slave ownership leaderboard')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'buy') {
            const target = interaction.options.getUser('user');
            if (target.id === interaction.user.id) return interaction.reply({ content: "❌ You can't buy yourself.", ephemeral: true });
            if (target.bot)                         return interaction.reply({ content: "❌ You can't buy a bot.", ephemeral: true });

            const buyer         = await getUser(interaction.user.id, interaction.guild.id);
            const targetEcon    = await getUser(target.id,           interaction.guild.id);
            const existingSlave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });
            if (existingSlave?.ownerId)
                return interaction.reply({ content: `❌ <@${target.id}> is already owned by <@${existingSlave.ownerId}>.`, ephemeral: true });

            const auctionKey = `${interaction.guild.id}-${target.id}`;
            if (activeAuctions.has(auctionKey))
                return interaction.reply({ content: `❌ There is already an active auction for <@${target.id}>.`, ephemeral: true });

            const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
            if (buyPrice <= 0) return interaction.reply({ content: '❌ This person has no balance to determine a price.', ephemeral: true });
            if (buyer.balance < buyPrice)
                return interaction.reply({ content: `❌ You need **$${formatNumber(buyPrice)}** but only have **$${formatNumber(buyer.balance)}**.`, ephemeral: true });

            activeAuctions.set(auctionKey, {
                type: 'buy', slaveId: target.id, sellerId: null,
                currentBidderId: interaction.user.id, currentBid: buyPrice,
                channelId: interaction.channel.id, endsAt: Date.now() + 120000
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

                const freshBuyer = await getUser(current.currentBidderId, interaction.guild.id);
                freshBuyer.balance = parseFloat((freshBuyer.balance - current.currentBid).toFixed(2));
                await freshBuyer.save();

                let slave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });
                if (!slave) slave = new Slave({ userId: target.id, guildId: interaction.guild.id });
                slave.ownerId = current.currentBidderId;
                slave.debt    = parseFloat((current.currentBid * 2).toFixed(2));
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

        if (sub === 'sell') {
            const target      = interaction.options.getUser('user');
            const startingBid = interaction.options.getInteger('startingbid');
            if (!startingBid || startingBid <= 0) return interaction.reply({ content: '❌ Starting bid must be greater than 0.', ephemeral: true });

            const slave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });
            if (!slave || slave.ownerId !== interaction.user.id)
                return interaction.reply({ content: `❌ You don't own <@${target.id}>.`, ephemeral: true });

            const auctionKey = `${interaction.guild.id}-${target.id}`;
            if (activeAuctions.has(auctionKey))
                return interaction.reply({ content: `❌ There is already an active auction for <@${target.id}>.`, ephemeral: true });

            activeAuctions.set(auctionKey, {
                type: 'sell', slaveId: target.id, sellerId: interaction.user.id,
                currentBidderId: null, currentBid: startingBid,
                channelId: interaction.channel.id, endsAt: Date.now() + 120000
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

                const winner = await getUser(current.currentBidderId, interaction.guild.id);
                winner.balance = parseFloat((winner.balance - current.currentBid).toFixed(2));
                await winner.save();

                const seller = await getUser(current.sellerId, interaction.guild.id);
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

        if (sub === 'outbid') {
            const amount = interaction.options.getNumber('amount');
            if (!amount || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });

            const guildAuctions = [...activeAuctions.entries()].filter(([k]) => k.startsWith(interaction.guild.id));
            if (!guildAuctions.length) return interaction.reply({ content: '❌ No active auctions in this server.', ephemeral: true });

            const bidder = await getUser(interaction.user.id, interaction.guild.id);

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

        if (sub === 'status') {
            const slave = await Slave.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
            if (!slave?.ownerId) return interaction.reply({ content: '✅ You are a free person.', ephemeral: true });
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('⛓️ Your Slave Status')
                .setDescription(`You are owned by <@${slave.ownerId}>`)
                .addFields(
                    { name: 'Debt Remaining',         value: `$${formatNumber(slave.debt)}`,        inline: true },
                    { name: 'Total Earned for Owner', value: `$${formatNumber(slave.totalEarned)}`, inline: true }
                )
                .setColor(0xFF0000)
                .setFooter({ text: 'Keep working to pay off your debt!' })
                .setTimestamp()] });
        }

        if (sub === 'panel') {
            const slaves = await Slave.find({ ownerId: interaction.user.id, guildId: interaction.guild.id });
            if (!slaves.length) return interaction.reply({ content: "❌ You don't own anyone.", ephemeral: true });
            for (let i = 0; i < slaves.length; i++) {
                const slave     = slaves[i];
                const slaveEcon = await getUser(slave.userId, interaction.guild.id);
                const embed = new EmbedBuilder()
                    .setTitle(`Slave: <@${slave.userId}>`)
                    .addFields(
                        { name: 'Debt Remaining',       value: `$${formatNumber(slave.debt)}`,        inline: true },
                        { name: 'Total Earned for You', value: `$${formatNumber(slave.totalEarned)}`, inline: true },
                        { name: 'Their Balance',        value: `$${formatNumber(slaveEcon.balance)}`, inline: true }
                    )
                    .setColor(0xFF4500).setTimestamp();
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`slave_free_${slave.userId}`).setLabel('Set Free').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`slave_renew_${slave.userId}`).setLabel('Renew (Double Debt)').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`slave_check_${slave.userId}`).setLabel('Refresh Stats').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`slave_takepay_${slave.userId}`).setLabel('Take Payment').setStyle(ButtonStyle.Primary)
                );
                const payload = { embeds: [embed], components: [row] };
                if (i === 0) await interaction.reply(payload);
                else await interaction.followUp(payload);
            }
        }

        if (sub === 'list') {
            const slaves = await Slave.find({ guildId: interaction.guild.id, ownerId: { $ne: null } });
            if (!slaves.length) return interaction.reply({ content: 'No active slaves in this server.', ephemeral: true });
            const ownerMap = {};
            for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;
            const lines = Object.entries(ownerMap)
                .sort((a, b) => b[1] - a[1])
                .map(([ownerId, count], i) => `**${i + 1}.** <@${ownerId}> - ${count} slave${count !== 1 ? 's' : ''}`);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('⛓️ Slave Leaderboard')
                .setDescription(lines.join('\n'))
                .setColor(0xFF4500)] });
        }
    }
};
