const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isAdmin } = require('../../utils/auth');
const Config = require('../../models/config');
const Stock = require('../../models/stock');
const EVENTS = require('./events');
const { setEvent, getActiveEvents, clearEvent } = require('./activeEvents');

const EVENT_COOLDOWN = 60 * 60 * 1000;
const guildCooldowns = new Map();

function getEventById(id) {
    return EVENTS.find(e => e.id === id) || null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Manage and trigger server events')
        .addSubcommand(sub => sub
            .setName('start')
            .setDescription('Start a server-wide event')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Event to trigger')
                .setRequired(true)
                .addChoices(
                    { name: 'Double Work Payouts', value: 'double_work' },
                    { name: 'Double Daily Rewards', value: 'double_daily' },
                    { name: 'Crime Wave', value: 'crime_boost' },
                    { name: 'Open Season', value: 'rob_boost' },
                    { name: 'Hot Table', value: 'gambling_boost' },
                    { name: 'Feeding Frenzy', value: 'fishing_boost' },
                    { name: 'Rich Vein', value: 'mining_boost' },
                    { name: 'Tax Holiday', value: 'tax_holiday' },
                    { name: 'Market Surge', value: 'stock_surge' },
                    { name: 'Market Crash', value: 'stock_crash' },
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('active')
            .setDescription('View all currently active events in this server')
        )
        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Set the announcement channel and ping role for events')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel where event announcements are posted')
                .setRequired(true)
            )
            .addRoleOption(o => o
                .setName('role')
                .setDescription('Role to ping when an event starts (optional)')
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('stop')
            .setDescription('Stop a currently active event early')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Event to stop')
                .setRequired(true)
                .addChoices(
                    { name: 'Double Work Payouts', value: 'double_work' },
                    { name: 'Double Daily Rewards', value: 'double_daily' },
                    { name: 'Crime Wave', value: 'crime_boost' },
                    { name: 'Open Season', value: 'rob_boost' },
                    { name: 'Hot Table', value: 'gambling_boost' },
                    { name: 'Feeding Frenzy', value: 'fishing_boost' },
                    { name: 'Rich Vein', value: 'mining_boost' },
                    { name: 'Tax Holiday', value: 'tax_holiday' },
                )
            )
        ),

    async execute(interaction) {
        if (!isAdmin(interaction))
            return interaction.reply({ content: '❌ Admin only.', ephemeral: true });

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const role = interaction.options.getRole('role');

            await Config.findOneAndUpdate(
                { guildId },
                {
                    $set: {
                        eventChannelId: channel.id,
                        eventRoleId: role?.id || null,
                    }
                },
                { upsert: true, new: true }
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Event Setup Saved')
                    .addFields(
                        { name: 'Announcement Channel', value: `<#${channel.id}>`, inline: true },
                        { name: 'Ping Role', value: role ? `<@&${role.id}>` : 'None', inline: true },
                    )
                    .setColor(0x00cc44)
                    .setFooter({ text: 'Admins can now trigger events from /event start or the dashboard.' })]
            });
        }

        if (sub === 'active') {
            const active = getActiveEvents(guildId);
            if (!active.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Active Events')
                        .setDescription('No events are currently running in this server.')
                        .setColor(0x2b2d31)],
                    ephemeral: true,
                });
            }

            const now = Date.now();
            const lines = active.map(({ id, expiresAt }) => {
                const event = getEventById(id);
                if (!event) return null;
                if (expiresAt === -1 || event.instant) return `${event.emoji} **${event.name}** - Instant (applied)`;
                const left = expiresAt - now;
                const m = Math.floor(left / 60000);
                const s = Math.ceil((left % 60000) / 1000);
                return `${event.emoji} **${event.name}** - ${m}m ${s}s remaining`;
            }).filter(Boolean);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Active Events')
                    .setDescription(lines.join('\n'))
                    .setColor(0xFFD700)]
            });
        }

        if (sub === 'stop') {
            const eventId = interaction.options.getString('type');
            const event = getEventById(eventId);
            if (!event) return interaction.reply({ content: '❌ Unknown event.', ephemeral: true });
            clearEvent(guildId, eventId);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`${event.emoji} Event Stopped`)
                    .setDescription(`**${event.name}** has been ended early.`)
                    .setColor(0x2b2d31)]
            });
        }

        if (sub === 'start') {
            const now = Date.now();
            const lastUsed = guildCooldowns.get(guildId) || 0;

            if (now - lastUsed < EVENT_COOLDOWN) {
                const left = EVENT_COOLDOWN - (now - lastUsed);
                const m = Math.floor(left / 60000);
                const s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({
                    content: `❌ Events are on cooldown. Next event available in **${m}m ${s}s**.`,
                    ephemeral: true,
                });
            }

            const eventId = interaction.options.getString('type');
            const event = getEventById(eventId);
            if (!event) return interaction.reply({ content: '❌ Unknown event.', ephemeral: true });

            const config = await Config.findOne({ guildId });
            const channelId = config?.eventChannelId;
            const roleId = config?.eventRoleId;

            if (event.instant) {
                const stocks = await Stock.find({ guildId });
                for (const stock of stocks) {
                    const isSurge = eventId === 'stock_surge';
                    const pct = isSurge
                        ? 1 + (0.05 + Math.random() * 0.10)
                        : 1 - (0.10 + Math.random() * 0.15);
                    stock.price = Math.max(0.01, parseFloat((stock.price * pct).toFixed(2)));
                    stock.history.push(stock.price);
                    if (stock.history.length > 30) stock.history.shift();
                    await stock.save();
                }
            } else {
                const expiresAt = now + event.duration;
                setEvent(guildId, eventId, expiresAt);

                setTimeout(() => {
                    clearEvent(guildId, eventId);
                    if (channelId) {
                        try {
                            const ch = interaction.client.channels.cache.get(channelId);
                            if (ch) ch.send({
                                embeds: [new EmbedBuilder()
                                    .setTitle(`${event.emoji} Event Ended`)
                                    .setDescription(`**${event.name}** has ended. The server returns to normal.`)
                                    .setColor(0x2b2d31)]
                            });
                        } catch {}
                    }
                }, event.duration);
            }

            guildCooldowns.set(guildId, now);

            const durationText = event.instant
                ? 'Instant effect applied.'
                : `Active for **${Math.round(event.duration / 60000)} minutes**.`;

            const embed = new EmbedBuilder()
                .setTitle(`${event.emoji} ${event.name}`)
                .setDescription(`${event.description}\n\n${durationText}`)
                .setColor(event.color)
                .setFooter({ text: `Started by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            if (channelId && channelId !== interaction.channelId) {
                try {
                    const ch = interaction.client.channels.cache.get(channelId);
                    if (ch) {
                        const content = roleId ? `<@&${roleId}>` : '';
                        await ch.send({ content, embeds: [embed] });
                    }
                } catch {}
            }
        }
    }
};
