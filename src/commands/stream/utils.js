const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { TIERS } = require('./config');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) { if (totalWealth >= t.min) tier = t; }
    return tier;
}

function buildEvents(user) {
    const hasMic    = hasItem(user, 'microphone');
    const hasServer = hasItem(user, 'dedicated_server');
    return [
        { id: 'raid',  weight: 15, label: 'Incoming Raid!',            fn: v => v + Math.floor(Math.random() * 1500 + 200) },
        { id: 'viral', weight: 5,  label: 'A clip went viral!',        fn: v => Math.floor(v * (1.5 + Math.random() * 1.5)) },
        { id: 'tech',  weight: 20, label: 'Technical difficulties...', fn: v => v },
        {
            id: 'drama', weight: 12, label: 'Drama in chat...',
            fn: hasMic
                ? v => Math.floor(v * (0.80 + Math.random() * 0.10))
                : v => Math.floor(v * (0.55 + Math.random() * 0.15)),
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

function buildPanel(title, body, footer, buttons) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    if (buttons) container.addActionRowComponents(buttons);
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function streamButtons(payout) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('stream_next').setLabel('Keep Streaming').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('stream_end').setLabel(`Cash Out ($${formatNumber(payout)})`).setStyle(ButtonStyle.Success),
    );
}

module.exports = { rand, getTier, buildEvents, rollEvent, buildPanel, streamButtons };
