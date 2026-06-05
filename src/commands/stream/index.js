const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasItem } = require('../../utils/inventory');
const { formatNumber } = require('../../utils/format');
const cooldowns = require('../../utils/cooldowns');
const { COOLDOWN, MAX_SEGMENTS, TIERS, CATEGORIES } = require('./config');
const { rand, getTier, buildEvents, rollEvent, buildPanel, streamButtons } = require('./utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stream')
        .setDescription('Start a livestream - requires Keyboard & Mouse from the shop'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!hasItem(user, 'keyboard_mouse'))
            return interaction.reply({ content: 'You need a **Keyboard & Mouse** to stream. Buy one from `/shop`.', ephemeral: true });

        const cdKey = `stream_${interaction.user.id}`;
        const now   = Date.now();

        if (cooldowns.stream.has(cdKey)) {
            const exp = cooldowns.stream.get(cdKey) + COOLDOWN;
            if (now < exp) {
                const readyAt = Math.floor(exp / 1000);
                return interaction.reply({ content: `You need to rest before streaming again. Ready <t:${readyAt}:R>.`, ephemeral: true });
            }
        }
        cooldowns.stream.set(cdKey, now);

        const totalWealth = user.balance + user.bank;
        const tier        = getTier(totalWealth);
        const nextTier    = TIERS[TIERS.indexOf(tier) + 1];
        const available   = tier.categories;
        const catId       = available[Math.floor(Math.random() * available.length)];
        const base        = CATEGORIES[catId];
        const hasCamera   = hasItem(user, 'camera');
        const hasLight    = hasItem(user, 'ring_light');
        const events      = buildEvents(user);

        const growthMin = base.growthMin + (hasLight ? 0.15 : 0);
        const growthMax = base.growthMax + (hasLight ? 0.15 : 0);

        const equipment = [
            hasCamera                         ? 'Camera'           : null,
            hasLight                          ? 'Ring Light'       : null,
            hasItem(user, 'microphone')       ? 'Microphone'       : null,
            hasItem(user, 'dedicated_server') ? 'Dedicated Server' : null,
        ].filter(Boolean);

        const baseViewers = rand(base.baseMin, base.baseMax);
        let viewers       = hasCamera ? Math.floor(baseViewers * 2.0) : baseViewers;
        let segment   = 0;
        let lastEvent = null;
        let ended     = false;

        const payout = () => Math.floor(viewers * 1.5);

        const body = () => [
            `**${formatNumber(viewers)}** viewers`,
            `Payout: **$${formatNumber(payout())}**`,
            segment > 0 ? `Segment ${segment}/${MAX_SEGMENTS}` : null,
            lastEvent ? `*${lastEvent.label}*` : null,
        ].filter(Boolean).join('  ·  ');

        const footer = () => [
            base.label,
            equipment.length ? equipment.join(' · ') : null,
            nextTier ? `More categories at $${formatNumber(nextTier.min)}` : null,
        ].filter(Boolean).join('  ·  ');

        const msg = await interaction.reply({
            ...buildPanel('Streaming', body(), footer(), streamButtons(payout())),
            fetchReply: true,
        });

        const collector = msg.createMessageComponentCollector({
            filter: j => j.user.id === interaction.user.id,
            time: 600000,
        });

        const finish = async (j = null, isOutage = false) => {
            ended = true;
            collector.stop('done');
            const earnings = payout();
            user.balance = parseFloat((user.balance + earnings).toFixed(2));
            await user.save();
            const title   = isOutage ? 'Stream Ended - ISP Outage' : `Stream Ended - ${base.label}`;
            const endBody = isOutage
                ? `Your internet cut out with **${formatNumber(viewers)}** viewers.\nYou earned **$${formatNumber(earnings)}** before it happened.`
                : `**${formatNumber(viewers)}** viewers  ·  **${segment}** segments\nYou earned **$${formatNumber(earnings)}**`;
            const panel = buildPanel(title, endBody, `New balance: $${formatNumber(user.balance)}`, null);
            if (j) await j.update(panel);
            else await msg.edit(panel).catch(() => {});
        };

        collector.on('collect', async j => {
            if (ended) return;
            if (j.customId === 'stream_end') { await finish(j); return; }
            if (j.customId !== 'stream_next') return;

            segment++;
            const event = rollEvent(events, base.eventChance);
            lastEvent   = event ?? null;

            if (event) {
                const next = event.fn(viewers);
                if (next === -1) { await finish(j, true); return; }
                viewers = Math.max(1, next);
            } else {
                const rate = growthMin + Math.random() * (growthMax - growthMin);
                viewers = Math.max(1, Math.floor(viewers * (1 + rate)));
            }

            if (segment >= MAX_SEGMENTS) { await finish(j); return; }
            await j.update(buildPanel('Streaming', body(), footer(), streamButtons(payout())));
        });

        collector.on('end', async (_, reason) => { if (!ended) await finish(); });
    }
};
