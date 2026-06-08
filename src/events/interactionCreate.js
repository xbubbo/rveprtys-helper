const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fetch = require('node-fetch');
const Slave = require('../models/slave');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const { handleCast, handleReel, handleCut, handleSell, handleBucket, handleBack } = require('../commands/fish/handlers');
const { handleShopSelect, handleShopMode, handleShopBuy, handleShopSell } = require('../commands/shop/browse');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (command) await command.execute(interaction);
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('shop_select'))  return handleShopSelect(interaction);
            if (interaction.customId.startsWith('shop_mode:'))   return handleShopMode(interaction);
        }

        if (interaction.isButton()) {

            if (interaction.customId.startsWith('shop_buy:'))              return handleShopBuy(interaction);
            if (interaction.customId.startsWith('shop_sell:'))             return handleShopSell(interaction);
            if (interaction.customId.startsWith('fish_cast:'))            return handleCast(interaction);
            if (interaction.customId.startsWith('fish_reel:'))          return handleReel(interaction);
            if (interaction.customId.startsWith('fish_cut:'))           return handleCut(interaction);
            if (interaction.customId.startsWith('fish_sell:'))          return handleSell(interaction);
            if (interaction.customId.startsWith('fish_bucket:'))        return handleBucket(interaction);
            if (interaction.customId.startsWith('fish_back:'))          return handleBack(interaction);

            if (interaction.customId.startsWith('slave_free_')) {
                const targetId = interaction.customId.split('_')[2];
                const slave    = await Slave.findOne({ userId: targetId });
                if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
                slave.ownerId = null; slave.debt = 0; slave.totalEarned = 0;
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🕊️ Slave Freed').setDescription(`<@${targetId}> has been set free.`).setColor(0x00FF99)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🕊️ You Are Free!').setDescription(`<@${interaction.user.id}> has set you free.`).setColor(0x00FF99)] }); } catch {}
            }

            if (interaction.customId.startsWith('slave_renew_')) {
                const targetId  = interaction.customId.split('_')[2];
                const slave     = await Slave.findOne({ userId: targetId });
                if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
                const renewCost = parseFloat((slave.debt / 2).toFixed(2));
                const owner     = await getUser(interaction.user.id);
                if (owner.balance < renewCost) return interaction.reply({ content: `❌ You need **$${formatNumber(renewCost)}** to renew.`, ephemeral: true });
                owner.balance = parseFloat((owner.balance - renewCost).toFixed(2));
                await owner.save();
                const oldDebt = slave.debt;
                slave.debt    = parseFloat((slave.debt * 2).toFixed(2));
                await slave.save();
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔄 Debt Renewed').setDescription(`Paid **$${formatNumber(renewCost)}** to renew.\nDebt: **$${formatNumber(oldDebt)}** → **$${formatNumber(slave.debt)}**`).setColor(0xFF4500)] });
                try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🔄 Your Debt Has Been Renewed!').setDescription(`Your debt doubled to **$${formatNumber(slave.debt)}**.`).setColor(0xFF4500)] }); } catch {}
            }

            if (interaction.customId.startsWith('slave_check_')) {
                const targetId = interaction.customId.split('_')[2];
                const slave    = await Slave.findOne({ userId: targetId });
                if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
                const slaveEcon = await getUser(targetId);
                await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
                    .setTitle(`📊 Stats for <@${targetId}>`)
                    .addFields(
                        { name: 'Debt Remaining',       value: `$${formatNumber(slave.debt)}`,           inline: true },
                        { name: 'Total Earned for You', value: `$${formatNumber(slave.totalEarned)}`,    inline: true },
                        { name: 'Their Balance',        value: `$${formatNumber(slaveEcon.balance)}`,    inline: true }
                    )
                    .setColor(0x2b2d31).setTimestamp()] });
            }

            if (interaction.customId.startsWith('slave_takepay_')) {
                const targetId = interaction.customId.split('_')[2];
                const slave    = await Slave.findOne({ userId: targetId });
                if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
                const modal = new ModalBuilder().setCustomId(`takepay_modal_${targetId}`).setTitle('Take Payment from Slave');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('takepay_amount').setLabel(`Amount to take (Debt: $${formatNumber(slave.debt)})`).setStyle(TextInputStyle.Short).setPlaceholder('e.g. 500').setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'open_order_modal') {
                const modal = new ModalBuilder().setCustomId('order_modal').setTitle('Order Form');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_ip').setLabel('Website IP').setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('website_name').setLabel('Website Name').setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('filters').setLabel('Filter Links').setStyle(TextInputStyle.Paragraph))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('respond_')) {
                const userId = interaction.customId.split('_')[1];
                const modal  = new ModalBuilder().setCustomId(`response_modal_${userId}`).setTitle('Send Links');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('links').setLabel('Insert Links here').setStyle(TextInputStyle.Paragraph)
                ));
                return interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('takepay_modal_')) {
                const targetId = interaction.customId.split('_')[2];
                const amount   = parseFloat(interaction.fields.getTextInputValue('takepay_amount'));
                if (!amount || isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid amount.', ephemeral: true });
                const slave = await Slave.findOne({ userId: targetId });
                if (!slave || slave.ownerId !== interaction.user.id) return interaction.reply({ content: '❌ Not your slave.', ephemeral: true });
                const slaveUser = await getUser(targetId);
                if (slaveUser.balance < amount) return interaction.reply({ content: `❌ <@${targetId}> only has **$${formatNumber(slaveUser.balance)}**.`, ephemeral: true });
                const taken = parseFloat(Math.min(amount, slave.debt).toFixed(2));
                slaveUser.balance = parseFloat((slaveUser.balance - taken).toFixed(2));
                await slaveUser.save();
                slave.debt = parseFloat((slave.debt - taken).toFixed(2));
                if (slave.debt <= 0) {
                    slave.ownerId = null; slave.debt = 0;
                    await slave.save();
                    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('✅ Debt Fully Paid!').setDescription(`Took **$${formatNumber(taken)}** from <@${targetId}> - debt cleared, they are free.`).setColor(0x00FF99)] });
                    try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('🕊️ You Are Free!').setDescription('Your remaining debt was paid. You are now free.').setColor(0x00FF99)] }); } catch {}
                } else {
                    await slave.save();
                    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 Payment Taken').setDescription(`Took **$${formatNumber(taken)}** from <@${targetId}>.`)
                        .addFields(
                            { name: 'Debt Remaining',          value: `$${formatNumber(slave.debt)}`,          inline: true },
                            { name: 'Their Remaining Balance', value: `$${formatNumber(slaveUser.balance)}`,   inline: true }
                        ).setColor(0xFF4500)] });
                    try { const u = await client.users.fetch(targetId); await u.send({ embeds: [new EmbedBuilder().setTitle('💰 Payment Taken').setDescription(`**$${formatNumber(taken)}** taken toward your debt.\nDebt remaining: **$${formatNumber(slave.debt)}**`).setColor(0xFF4500)] }); } catch {}
                }
            }

            if (interaction.customId === 'order_modal') {
                const ip      = interaction.fields.getTextInputValue('website_ip');
                const name    = interaction.fields.getTextInputValue('website_name');
                const filters = interaction.fields.getTextInputValue('filters');
                const userId  = interaction.user.id;
                await interaction.user.send('Your order has been received. You will get your links soon.');
                await fetch(process.env.WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [{ title: 'New Order', fields: [{ name: 'User', value: `<@${userId}>` }, { name: 'Website IP', value: ip }, { name: 'Website Name', value: name }, { name: 'Filters', value: filters }], color: 0x2b2d31 }], components: [{ type: 1, components: [{ type: 2, label: 'Send Links', style: 1, custom_id: `respond_${userId}` }] }] })
                });
                return interaction.reply({ content: 'Order submitted! Check your DMs.', ephemeral: true });
            }

            if (interaction.customId.startsWith('response_modal_')) {
                const userId = interaction.customId.split('_')[2];
                const links  = interaction.fields.getTextInputValue('links');
                try { const u = await client.users.fetch(userId); await u.send(`Your Order is Ready!\n\n${links}`); return interaction.reply({ content: 'Links sent to user.', ephemeral: true }); }
                catch { return interaction.reply({ content: 'Failed to DM user.', ephemeral: true }); }
            }
        }
    }
};
