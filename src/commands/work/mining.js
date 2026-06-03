const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../utils/format');
const { hasItem, consumeItem } = require('../../utils/inventory');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN = 30 * 60 * 1000;

const TIERS = [
    { min: 0,      label: 'Surface Mine', dist: { empty: 6, coal: 5, iron: 3, gold: 2, ruby: 0, diamond: 0, cavein: 0 } },
    { min: 25000,  label: 'Cave',         dist: { empty: 4, coal: 4, iron: 3, gold: 2, ruby: 1, diamond: 0, cavein: 2 } },
    { min: 100000, label: 'Deep Cave',    dist: { empty: 2, coal: 3, iron: 3, gold: 3, ruby: 2, diamond: 1, cavein: 2 } },
    { min: 500000, label: 'Magma Core',   dist: { empty: 1, coal: 2, iron: 2, gold: 3, ruby: 3, diamond: 2, cavein: 3 } },
];

const ORES = {
    empty:   { emoji: '⬛', min: 0,      max: 0      },
    coal:    { emoji: '⚫', min: 50,     max: 200    },
    iron:    { emoji: '⬜', min: 200,    max: 600    },
    gold:    { emoji: '🟡', min: 800,    max: 2500   },
    ruby:    { emoji: '🔴', min: 3000,   max: 9000   },
    diamond: { emoji: '💎', min: 15000,  max: 50000  },
    cavein:  { emoji: '💥', min: 0,      max: 0      },
};

function getTier(totalWealth) {
    let tier = TIERS[0];
    for (const t of TIERS) { if (totalWealth >= t.min) tier = t; }
    return tier;
}

function getPickaxeMultiplier(user) {
    if (hasItem(user, 'pickaxe_diamond')) return 1.45;
    if (hasItem(user, 'pickaxe_iron'))    return 1.20;
    return 1.0;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

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

async function execute(interaction, user) {
    const cdKey = `mine_${interaction.user.id}`;
    const now   = Date.now();

    if (cooldowns.mine.has(cdKey)) {
        const exp = cooldowns.mine.get(cdKey) + COOLDOWN;
        if (now < exp) {
            const totalSecs = Math.ceil((exp - now) / 1000);
            const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
            return interaction.reply({ content: `⏳ Your tools need to recover. Try again in **${m}m ${s}s**.`, ephemeral: true });
        }
    }
    cooldowns.mine.set(cdKey, now);

    const totalWealth   = user.balance + user.bank;
    const tier          = getTier(totalWealth);
    const nextTier      = TIERS[TIERS.indexOf(tier) + 1];
    const pickMulti     = getPickaxeMultiplier(user);
    const hasBackpack   = hasItem(user, 'mining_backpack');
    const caveinLoss    = hasBackpack ? 0.10 : 0.25;

    // Consume bomb if present - auto-reveals 3 safe tiles
    const useBomb   = consumeItem(user, 'mining_bomb');
    if (useBomb) await user.save();

    const tiles    = buildTiles(tier.dist);
    const revealed = Array(16).fill(false);
    let earned     = 0;
    let caveins    = 0;
    let gameOver   = false;

    // Auto-reveal 3 safe tiles if bomb used
    if (useBomb) {
        const safeTileIndices = tiles
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => t !== 'empty' && t !== 'cavein' && ORES[t].max > 0)
            .map(({ i }) => i);
        const toReveal = safeTileIndices.sort(() => Math.random() - 0.5).slice(0, 3);
        for (const idx of toReveal) {
            revealed[idx] = true;
            const ore = ORES[tiles[idx]];
            if (ore.max > 0) earned += Math.floor(rand(ore.min, ore.max) * pickMulti);
        }
    }

    const pickName = hasItem(user, 'pickaxe_diamond') ? 'Diamond Pickaxe' : hasItem(user, 'pickaxe_iron') ? 'Iron Pickaxe' : 'Basic Pickaxe';
    const extras   = [pickName, hasBackpack ? '🎒 Backpack' : null, useBomb ? '💥 Bomb used' : null].filter(Boolean).join(' • ');

    const buildGrid = (done = false) => {
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
    };

    const mineEmbed = (state = 'mining') => {
        const base = `Ore found: **$${formatNumber(earned)}**` +
            (caveins > 0 ? ` | Cave-ins: **${caveins}** (-${Math.round(caveinLoss * 100)}% each)` : '') +
            `\n*${extras}*` +
            (nextTier ? `\n\n*Unlock **${nextTier.label}** at $${formatNumber(nextTier.min)} total wealth*` : '');
        if (state === 'mining')  return new EmbedBuilder().setTitle(`Mining - ${tier.label}`).setDescription(base + '\n\nClick tiles to mine. Cash out anytime.').setColor(0x8B4513);
        if (state === 'cashout') return new EmbedBuilder().setTitle(`Mining Complete - ${tier.label}`).setDescription(`You hauled **$${formatNumber(earned)}** worth of ore.`).setColor(0x00cc44);
        if (state === 'cleared') return new EmbedBuilder().setTitle(`Mine Cleared! - ${tier.label}`).setDescription(`Every vein mined! Total haul: **$${formatNumber(earned)}**`).setColor(0xFFD700);
        if (state === 'timeout') return new EmbedBuilder().setTitle(`Session Expired - ${tier.label}`).setDescription(`Timed out. Ore collected: **$${formatNumber(earned)}**`).setColor(0x71717a);
    };

    const finish = async (state, j = null) => {
        gameOver = true;
        gameCollector.stop(state);
        if (earned > 0) {
            user.balance = parseFloat((user.balance + earned).toFixed(2));
            await user.save();
            const embed = mineEmbed(state).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true });
            if (j) await j.update({ embeds: [embed], components: buildGrid(true) });
            else await msg.edit({ embeds: [embed], components: buildGrid(true) }).catch(() => {});
        } else {
            if (j) await j.update({ embeds: [mineEmbed(state)], components: buildGrid(true) });
            else await msg.edit({ embeds: [mineEmbed(state)], components: buildGrid(true) }).catch(() => {});
        }
    };

    const msg = await interaction.reply({ embeds: [mineEmbed()], components: buildGrid(), fetchReply: true });

    const gameCollector = msg.createMessageComponentCollector({
        filter: j => j.user.id === interaction.user.id,
        time: 300000,
    });

    gameCollector.on('collect', async j => {
        if (gameOver) return;
        if (j.customId === 'mine_cashout') { await finish('cashout', j); return; }
        if (!j.customId.startsWith('ore_')) return;
        const idx = parseInt(j.customId.split('_')[1]);
        if (revealed[idx]) return;
        revealed[idx] = true;

        const type = tiles[idx];
        if (type === 'cavein') {
            caveins++;
            earned = Math.max(0, Math.floor(earned * (1 - caveinLoss)));
            await j.update({ embeds: [mineEmbed()], components: buildGrid() });
            return;
        }

        const ore = ORES[type];
        if (ore.max > 0) earned += Math.floor(rand(ore.min, ore.max) * pickMulti);

        const allMined = tiles.every((t, i) => t === 'empty' || t === 'cavein' || revealed[i]);
        if (allMined) { await finish('cleared', j); return; }

        await j.update({ embeds: [mineEmbed()], components: buildGrid() });
    });

    gameCollector.on('end', async (_, reason) => { if (!gameOver) await finish('timeout'); });
}

module.exports = { execute, TIERS, COOLDOWN };
