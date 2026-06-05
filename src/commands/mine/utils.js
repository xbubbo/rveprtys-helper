const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem } = require('../../utils/inventory');
const { ITEMS, PICKAXE_TIERS } = require('../shop/items');
const { TIERS, ORES } = require('./ores');

const PICKAXE_STATS = {
    pickaxe_wooden:   { multiplier: 1.00 },
    pickaxe_basic:    { multiplier: 1.15 },
    pickaxe_iron:     { multiplier: 1.30 },
    pickaxe_diamond:  { multiplier: 1.55 },
    pickaxe_netherite:{ multiplier: 1.90 },
};

function getPickaxe(user) {
    for (let i = PICKAXE_TIERS.length - 1; i >= 0; i--) {
        const id = PICKAXE_TIERS[i];
        if (hasItem(user, id)) return { id, ...ITEMS[id], stats: PICKAXE_STATS[id] };
    }
    return null;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) { if (totalWealth >= t.min) tier = t; }
    return tier;
}

function buildTiles(dist) {
    const tiles = [];
    for (const [type, count] of Object.entries(dist)) {
        for (let i = 0; i < count; i++) tiles.push(type);
    }
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
}

function buildGrid(tiles, revealed, earned, gameOver, done = false) {
    const rows = [];
    for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 4; c++) {
            const idx = r * 4 + c;
            const btn = new ButtonBuilder().setCustomId(`ore_${idx}`).setStyle(ButtonStyle.Secondary);
            if (revealed[idx]) {
                const ore = ORES[tiles[idx]];
                btn.setEmoji(ore.emoji)
                    .setStyle(tiles[idx] === 'cavein' ? ButtonStyle.Danger : tiles[idx] === 'empty' ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setDisabled(true);
            } else {
                btn.setEmoji('🟫').setDisabled(done || gameOver);
            }
            row.addComponents(btn);
        }
        rows.push(row);
    }
    if (!done && !gameOver) {
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mine_cashout')
                .setLabel(`Cash Out ($${formatNumber(earned)})`)
                .setStyle(ButtonStyle.Primary)
        ));
    }
    return rows;
}

function buildPanel(title, body, footer, gridRows) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (footer) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
    }
    for (const row of gridRows) {
        container.addActionRowComponents(row);
    }
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

module.exports = { rand, getTier, getPickaxe, buildTiles, buildGrid, buildPanel };
