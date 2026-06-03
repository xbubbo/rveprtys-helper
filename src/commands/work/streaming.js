const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN    = 45 * 60 * 1000;
const MAX_SEGMENTS = 20;

const TIERS = [
    { min: 0,      categories: ['fps', 'music']                          },
    { min: 50000,  categories: ['fps', 'music', 'rpg', 'variety']        },
    { min: 150000, categories: ['fps', 'music', 'rpg', 'variety', 'irl'] },
];

const CATEGORIES = {
    fps:     { label: 'FPS Gaming',  baseMin: 20,  baseMax: 80,  growthMin: 0.05, growthMax: 0.20, eventChance: 0.20 },
    rpg:     { label: 'RPG Gaming',  baseMin: 10,  baseMax: 50,  growthMin: 0.08, growthMax: 0.25, eventChance: 0.18 },
    music:   { label: 'Music',       baseMin: 5,   baseMax: 30,  growthMin: 0.03, growthMax: 0.15, eventChance: 0.15 },
    variety: { label: 'Variety',     baseMin: 10,  baseMax: 100, growthMin: 0,    growthMax: 0.35, eventChance: 0.22 },
    irl:     { label: 'IRL',         baseMin: 25,  baseMax: 120, growthMin: 0.10, growthMax: 0.30, eventChance: 0.30 },
};

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) { if (totalWealth >= t.min) tier = t; }
    return tier;
}

function buildEvents(user) {
    const hasMic    = hasItem(user, 'microphone');
    const hasServer = hasItem(user, 'dedicated_server');
    return [
        { id: 'raid',  weight: 15, label: 'Incoming Raid!',           fn: v => v + Math.floor(Math.random() * 1500 + 200) },
        { id: 'viral', weight: 5,  label: 'A clip went viral!',       fn: v => Math.floor(v * (1.5 + Math.random() * 1.5)) },
        { id: 'tech',  weight: 20, label: 'Technical difficulties...', fn: v => v },
        {
            id: 'drama', weight: 12, label: 'Drama in chat...',
            fn: hasMic
                ? v => Math.floor(v * (0.80 + Math.random() * 0.10))  // mic: -10-20%
                : v => Math.floor(v * (0.55 + Math.random() * 0.15)), // no mic: -30-45%
        },
        { id: 'isp', weight: hasServer ? 1.5 : 6, label: 'ISP outage!', fn: () => -1 },
    ];
}

function rollEvent(events, chance) {
    if (Math.random() > chance) return null;
    const total = events.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    for (const e of events) { r -= e.weight; if (r <= 0) return e; }
    return events[events.length - 1];
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function execute(interaction, user) {
    const cdKey = `stream_${interaction.user.id}`;
    const now   = Date.now();

    if (cooldowns.stream.has(cdKey)) {
        const exp = cooldowns.stream.get(cdKey) + COOLDOWN;
        if (now < exp) {
            const totalSecs = Math.ceil((exp - now) / 1000);
            const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
            return interaction.reply({ content: `⏳ You need to rest before streaming again. Try in **${m}m ${s}s**.`, ephemeral: true });
        }
    }
    cooldowns.stream.set(cdKey, now);

    const totalWealth = user.balance + user.bank;
    const tier        = getTier(totalWealth);
    const nextTier    = TIERS[TIERS.indexOf(tier) + 1];
    const available   = tier.categories;
    const catId       = available[Math.floor(Math.random() * available.length)];
    const base        = CATEGORIES[catId];
    const hasLight    = hasItem(user, 'ring_light');
    const hasMic      = hasItem(user, 'microphone');
    const hasServer   = hasItem(user, 'dedicated_server');
    const events      = buildEvents(user);

    // Apply ring light growth bonus
    const growthMin = base.growthMin + (hasLight ? 0.10 : 0);
    const growthMax = base.growthMax + (hasLight ? 0.10 : 0);

    const equipment = [
        hasLight  ? '💡 Ring Light'        : null,
        hasMic    ? '🎙️ Microphone'        : null,
        hasServer ? '🖥️ Dedicated Server'  : null,
    ].filter(Boolean);

    let viewers   = rand(base.baseMin, base.baseMax);
    let segment   = 0;
    let lastEvent = null;
    let ended     = false;

    const payout = () => Math.floor(viewers * 1.5);

    const streamEmbed = () => new EmbedBuilder()
        .setTitle(`Streaming - ${base.label}`)
        .setDescription([
            `**${formatNumber(viewers)}** viewers watching`,
            `Payout if you stop now: **$${formatNumber(payout())}**`,
            segment > 0 ? `Segment ${segment}/${MAX_SEGMENTS}` : null,
            lastEvent ? `\n*${lastEvent.label}*` : null,
            equipment.length ? `\n${equipment.join(' • ')}` : null,
            nextTier ? `\n*Unlock more categories at $${formatNumber(nextTier.min)} total wealth*` : null,
        ].filter(Boolean).join('\n'))
        .setColor(viewers >= 1000 ? 0x9b59b6 : viewers >= 200 ? 0x6441a5 : 0x4a3281);

    const streamButtons = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('stream_next').setLabel('Keep Streaming').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stream_end').setLabel(`Cash Out ($${formatNumber(payout())})`).setStyle(ButtonStyle.Success),
    );

    const msg = await interaction.reply({ embeds: [streamEmbed()], components: [streamButtons()], fetchReply: true });

    const collector = msg.createMessageComponentCollector({
        filter: j => j.user.id === interaction.user.id,
        time: 600000,
    });

    const finish = async (j = null) => {
        ended = true;
        collector.stop('done');
        const earnings = payout();
        user.balance = parseFloat((user.balance + earnings).toFixed(2));
        await user.save();
        const embed = new EmbedBuilder()
            .setTitle(`Stream Ended - ${base.label}`)
            .setDescription(`**${formatNumber(viewers)}** viewers | **${segment}** segments\nYou earned **$${formatNumber(earnings)}**!`)
            .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
            .setColor(0x00cc44);
        if (j) await j.update({ embeds: [embed], components: [] });
        else await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
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
            if (next === -1) {
                ended = true;
                collector.stop('done');
                const earnings = payout();
                user.balance = parseFloat((user.balance + earnings).toFixed(2));
                await user.save();
                return j.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('Stream Ended - ISP Outage')
                        .setDescription(`Your internet cut out with **${formatNumber(viewers)}** viewers.\nYou earned **$${formatNumber(earnings)}** before it happened.`)
                        .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                        .setColor(0xff3333)],
                    components: [],
                });
            }
            viewers = Math.max(1, next);
        } else {
            const rate = growthMin + Math.random() * (growthMax - growthMin);
            viewers = Math.max(1, Math.floor(viewers * (1 + rate)));
        }

        if (segment >= MAX_SEGMENTS) { await finish(j); return; }
        await j.update({ embeds: [streamEmbed()], components: [streamButtons()] });
    });

    collector.on('end', async (_, reason) => { if (!ended) await finish(); });
}

module.exports = { execute, TIERS, COOLDOWN };
