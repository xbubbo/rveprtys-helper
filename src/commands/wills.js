const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber, parseAmount } = require('../utils/format');
const Will = require('../models/will');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('will')
        .setDescription('Manage your will - designate who receives your funds if you go inactive')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Create or update your will')
                .addUserOption(o => o.setName('beneficiary').setDescription('Who receives your funds').setRequired(true))
                .addStringOption(o => o.setName('amount').setDescription('Amount to leave them (or: all, half, 10k)').setRequired(true))
                .addIntegerOption(o =>
                    o.setName('days')
                        .setDescription('Days of inactivity before the will executes (default: 30)')
                        .setMinValue(7)
                        .setMaxValue(90)
                        .setRequired(false)
                )
                .addStringOption(o => o.setName('note').setDescription('Optional final message').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View your current will')
        )
        .addSubcommand(sub =>
            sub.setName('revoke')
                .setDescription('Cancel your existing will')
        )
        .addSubcommand(sub =>
            sub.setName('incoming')
                .setDescription('Check if anyone has named you as a beneficiary')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'set') {
            const beneficiary = interaction.options.getUser('beneficiary');
            const amountStr = interaction.options.getString('amount');
            const days = interaction.options.getInteger('days') ?? 30;
            const note = interaction.options.getString('note') ?? '';

            if (beneficiary.id === userId)
                return interaction.reply({ content: 'You cannot name yourself as a beneficiary.', ephemeral: true });
            if (beneficiary.bot)
                return interaction.reply({ content: 'Bots cannot be named as beneficiaries.', ephemeral: true });

            const user = await getUser(userId);
            const amount = parseAmount(amountStr, user.balance + user.bank);

            if (isNaN(amount) || amount <= 0)
                return interaction.reply({ content: 'Invalid amount.', ephemeral: true });
            if (amount > user.balance + user.bank)
                return interaction.reply({ content: `You only have **$${formatNumber(user.balance + user.bank)}** total wealth. You cannot leave more than you own.`, ephemeral: true });

            await Will.findOneAndUpdate(
                { userId },
                { userId, beneficiaryId: beneficiary.id, amount, note, inactivityDays: days, executed: false, createdAt: Date.now() },
                { upsert: true, new: true }
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Will Filed')
                    .setDescription(`Your will has been recorded. If you go inactive for **${days} days**, **$${formatNumber(amount)}** will be transferred to <@${beneficiary.id}>.`)
                    .addFields(
                        { name: 'Beneficiary', value: `<@${beneficiary.id}>`, inline: true },
                        { name: 'Amount', value: `$${formatNumber(amount)}`, inline: true },
                        { name: 'Triggers After', value: `${days} days inactive`, inline: true },
                        ...(note ? [{ name: 'Final Note', value: note, inline: false }] : [])
                    )
                    .setColor(0x2b2d31)
                    .setFooter({ text: 'Use /will revoke to cancel at any time.' })]
            });
        }

        if (sub === 'view') {
            const will = await Will.findOne({ userId, executed: false });
            if (!will)
                return interaction.reply({ content: 'You have no active will. Use `/will set` to create one.', ephemeral: true });

            const daysAgo = Math.floor((Date.now() - will.createdAt) / 86400000);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Your Will')
                    .addFields(
                        { name: 'Beneficiary', value: `<@${will.beneficiaryId}>`, inline: true },
                        { name: 'Amount', value: `$${formatNumber(will.amount)}`, inline: true },
                        { name: 'Triggers After', value: `${will.inactivityDays} days inactive`, inline: true },
                        { name: 'Filed', value: `${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`, inline: true },
                        ...(will.note ? [{ name: 'Final Note', value: will.note, inline: false }] : [])
                    )
                    .setColor(0x2b2d31)]
            });
        }

        if (sub === 'revoke') {
            const result = await Will.findOneAndDelete({ userId, executed: false });
            if (!result)
                return interaction.reply({ content: 'You have no active will to revoke.', ephemeral: true });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Will Revoked')
                    .setDescription('Your will has been destroyed. Your assets will not be transferred upon inactivity.')
                    .setColor(0x2b2d31)]
            });
        }

        if (sub === 'incoming') {
            const wills = await Will.find({ beneficiaryId: userId, executed: false });
            if (!wills.length)
                return interaction.reply({ content: 'No one has named you as a beneficiary.', ephemeral: true });

            const lines = wills.map(w => {
                const daysLeft = w.inactivityDays - Math.floor((Date.now() - w.createdAt) / 86400000);
                return `<@${w.userId}> - **$${formatNumber(w.amount)}** - triggers in ~${Math.max(0, daysLeft)} days`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Incoming Wills')
                    .setDescription(lines.join('\n'))
                    .setColor(0x2b2d31)
                    .setFooter({ text: `${wills.length} active will${wills.length !== 1 ? 's' : ''} naming you.` })]
            });
        }
    }
};