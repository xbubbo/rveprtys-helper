const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const Slave = require('../../models/Slave');

const COOLDOWN = 2 * 60 * 1000;
const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Earn some money'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now  = Date.now();

        if (user.lastWork && now - user.lastWork < COOLDOWN) {
            const left = COOLDOWN - (now - user.lastWork);
            const s = Math.ceil(left / 1000);
            return interaction.reply({ content: `⏳ You need to wait **${s}s** before working again.`, ephemeral: true });
        }

        const amount = Math.floor(Math.random() * 76) + 25;
        user.lastWork = now;

        const slave = await Slave.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });

        if (slave?.ownerId) {
            slave.debt        = parseFloat((slave.debt        - amount).toFixed(2));
            slave.totalEarned = parseFloat((slave.totalEarned + amount).toFixed(2));

            const owner = await getUser(slave.ownerId, interaction.guild.id);
            owner.balance = parseFloat((owner.balance + amount).toFixed(2));
            await owner.save();

            if (slave.debt <= 0) {
                const freedOwnerId = slave.ownerId;
                slave.ownerId = null;
                slave.debt    = 0;
                await slave.save();
                await user.save();
                try {
                    const ownerUser = await interaction.client.users.fetch(freedOwnerId);
                    await ownerUser.send({ embeds: [new EmbedBuilder()
                        .setTitle('Slave Debt Paid Off')
                        .setDescription(`<@${interaction.user.id}> has paid off their debt and is now free.`)
                        .setColor(0x00FF99)] });
                } catch {}
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle('You Are Free!')
                    .setDescription(`You worked and earned **$${fmtInt(amount)}** — your debt is fully paid off!`)
                    .setColor(0x00FF99)] });
            }

            await slave.save();
            await user.save();
            try {
                const ownerUser = await interaction.client.users.fetch(slave.ownerId);
                await ownerUser.send({ embeds: [new EmbedBuilder()
                    .setTitle('Your Slave Worked!')
                    .setDescription(`<@${interaction.user.id}> earned **$${fmtInt(amount)}** for you.\nRemaining debt: **$${fmt(slave.debt)}**`)
                    .setColor(0x2b2d31)] });
            } catch {}
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Work Complete')
                .setDescription(`You earned **$${fmtInt(amount)}** — but it went to your owner <@${slave.ownerId}>.\n\n**Debt Remaining:** $${fmt(slave.debt)}`)
                .setColor(0xFF4500)
                .setFooter({ text: 'Keep working to pay off your debt!' })] });
        }

        user.balance += amount;
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle('Work Complete')
            .setDescription(`You earned **$${fmtInt(amount)}**`)
            .setColor(0x00ff00)] });
    }
};
