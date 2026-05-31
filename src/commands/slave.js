const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../utils/economy');
const Slave = require('../../models/Slave');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

            const buyPrice = parseFloat((targetEcon.balance * 2).toFixed(2));
            if (buyPrice <= 0) return interaction.reply({ content: '❌ This person has no balance to determine a price.', ephemeral: true });
            if (buyer.balance < buyPrice)
                return interaction.reply({ content: `❌ You need **$${fmt(buyPrice)}** to buy <@${target.id}> but only have **$${fmt(buyer.balance)}**.`, ephemeral: true });

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Auction Started!')
                .setDescription(
                    `<@${interaction.user.id}> wants to buy <@${target.id}> for **$${fmt(buyPrice)}**!\n\n` +
                    `<@${target.id}> you have **2 minutes** to escape by typing \`?outbid <amount>\` with more than **$${fmt(buyPrice)}**.`
                )
                .setColor(0xFF4500)
                .setTimestamp()] });

            const collector = interaction.channel.createMessageCollector({
                filter: m => m.author.id === target.id && m.content.toLowerCase().startsWith('?outbid'),
                time: 120000,
                max: 1
            });

            collector.on('collect', async m => {
                const outbidAmount = parseFloat(m.content.split(/\s+/)[1]);
                if (!outbidAmount || outbidAmount <= buyPrice)
                    return m.reply(`❌ You need to outbid more than **$${fmt(buyPrice)}**.`);
                const fresh = await getUser(target.id, interaction.guild.id);
                if (fresh.balance < outbidAmount)
                    return m.reply(`❌ You don't have **$${fmt(outbidAmount)}** to outbid.`);
                collector.stop('outbid');
                return m.reply({ embeds: [new EmbedBuilder()
                    .setTitle('Purchase Blocked!')
                    .setDescription(`<@${target.id}> outbid with **$${fmt(outbidAmount)}** and avoided being bought!`)
                    .setColor(0x00FF99)] });
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'outbid') return;

                const freshBuyer = await getUser(interaction.user.id, interaction.guild.id);
                freshBuyer.balance = parseFloat((freshBuyer.balance - buyPrice).toFixed(2));
                await freshBuyer.save();

                let slave = await Slave.findOne({ userId: target.id, guildId: interaction.guild.id });
                if (!slave) slave = new Slave({ userId: target.id, guildId: interaction.guild.id });
                slave.ownerId     = interaction.user.id;
                slave.debt        = parseFloat((buyPrice * 2).toFixed(2));
                slave.totalEarned = 0;
                await slave.save();

                await interaction.followUp({ embeds: [new EmbedBuilder()
                    .setTitle('Purchase Complete!')
                    .setDescription(
                        `<@${interaction.user.id}> has bought <@${target.id}> for **$${fmt(buyPrice)}**!\n\n` +
                        `<@${target.id}> must earn **$${fmt(buyPrice * 2)}** to be free.`
                    )
                    .setColor(0xFF0000)
                    .setTimestamp()] });

                try {
                    await target.send({ embeds: [new EmbedBuilder()
                        .setTitle('You Have Been Bought!')
                        .setDescription(`<@${interaction.user.id}> purchased you for **$${fmt(buyPrice)}**. You must earn **$${fmt(buyPrice * 2)}** to be free.`)
                        .setColor(0xFF0000)] });
                } catch {}
            });
        }

        if (sub === 'status') {
            const slave = await Slave.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });

            if (!slave?.ownerId)
                return interaction.reply({ content: '✅ You are a free person.', ephemeral: true });

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Your Slave Status')
                .setDescription(`You are owned by <@${slave.ownerId}>`)
                .addFields(
                    { name: 'Debt Remaining',         value: `$${fmt(slave.debt)}`,        inline: true },
                    { name: 'Total Earned for Owner', value: `$${fmt(slave.totalEarned)}`, inline: true }
                )
                .setColor(0xFF0000)
                .setFooter({ text: 'Keep working to pay off your debt!' })
                .setTimestamp()] });
        }

        if (sub === 'panel') {
            const slaves = await Slave.find({ ownerId: interaction.user.id, guildId: interaction.guild.id });
            if (!slaves.length)
                return interaction.reply({ content: "❌ You don't own anyone.", ephemeral: true });

            for (let i = 0; i < slaves.length; i++) {
                const slave     = slaves[i];
                const slaveEcon = await getUser(slave.userId, interaction.guild.id);

                const embed = new EmbedBuilder()
                    .setTitle(`Slave: <@${slave.userId}>`)
                    .addFields(
                        { name: 'Debt Remaining',       value: `$${fmt(slave.debt)}`,        inline: true },
                        { name: 'Total Earned for You', value: `$${fmt(slave.totalEarned)}`, inline: true },
                        { name: 'Their Balance',        value: `$${fmt(slaveEcon.balance)}`, inline: true }
                    )
                    .setColor(0xFF4500)
                    .setTimestamp();

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
            if (!slaves.length)
                return interaction.reply({ content: 'No active slaves in this server.', ephemeral: true });

            const ownerMap = {};
            for (const s of slaves) ownerMap[s.ownerId] = (ownerMap[s.ownerId] || 0) + 1;

            const lines = Object.entries(ownerMap)
                .sort((a, b) => b[1] - a[1])
                .map(([ownerId, count], i) => `**${i + 1}.** <@${ownerId}> - ${count} slave${count !== 1 ? 's' : ''}`);

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Slave Leaderboard')
                .setDescription(lines.join('\n'))
                .setColor(0xFF4500)] });
        }
    }
};
