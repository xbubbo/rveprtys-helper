const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { hasAnyItem, hasItem, consumeItem } = require('../../utils/inventory'); // hasItem used for backpack check
const cooldowns = require('../../utils/cooldowns');
const { formatNumber } = require('../../utils/format');
const { COOLDOWN, TIERS, ORES } = require('./ores');
const { rand, getTier, getPickaxe, buildTiles, buildGrid, buildPanel, PICKAXE_STATS } = require('./utils');
const { ITEMS } = require('../shop/items');

const PICKAXES = ['pickaxe_wooden', 'pickaxe_basic', 'pickaxe_iron', 'pickaxe_diamond', 'pickaxe_netherite'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Go mining - requires a pickaxe from the shop')
        .addStringOption(o =>
            o.setName('pickaxe').setDescription('Which pickaxe to use (defaults to highest tier)').setRequired(false)
                .addChoices(
                    { name: 'Wooden Pickaxe',    value: 'pickaxe_wooden'    },
                    { name: 'Basic Pickaxe',     value: 'pickaxe_basic'     },
                    { name: 'Iron Pickaxe',      value: 'pickaxe_iron'      },
                    { name: 'Diamond Pickaxe',   value: 'pickaxe_diamond'   },
                    { name: 'Netherite Pickaxe', value: 'pickaxe_netherite' },
                )
        ),

    async execute(interaction) {
        const user = await getUser(interaction.user.id);
        if (!hasAnyItem(user, PICKAXES))
            return interaction.reply({ content: 'You need a pickaxe to go mining. Buy one from `/shop`.', ephemeral: true });

        const cdKey = `mine_${interaction.user.id}`;
        const now   = Date.now();

        if (cooldowns.mine.has(cdKey)) {
            const exp = cooldowns.mine.get(cdKey) + COOLDOWN;
            if (now < exp) {
                const readyAt = Math.floor(exp / 1000);
                return interaction.reply({ content: `Your tools need to recover. Ready <t:${readyAt}:R>.`, ephemeral: true });
            }
        }
        const chosenId = interaction.options.getString('pickaxe');
        let pickaxe;
        if (chosenId) {
            if (!hasItem(user, chosenId))
                return interaction.reply({ content: `❌ You don't own a **${ITEMS[chosenId]?.name ?? chosenId}**. Buy one from \`/shop\`.`, ephemeral: true });
            pickaxe = { id: chosenId, ...ITEMS[chosenId], stats: PICKAXE_STATS[chosenId] };
        } else {
            pickaxe = getPickaxe(user);
        }
        const tier          = getTier(pickaxe.id);
        const nextTier      = TIERS.slice(TIERS.indexOf(tier) + 1).find(t => !hasItem(user, t.pickaxe));
        const nextPickaxe   = nextTier ? ITEMS[nextTier.pickaxe] : null;
        const pickMulti   = pickaxe.stats.multiplier;
        const hasBackpack = hasItem(user, 'mining_backpack');
        const caveinLoss  = hasBackpack ? 0.10 : 0.50;

        // Deduct durability - use || so 0 falls back to item.durability (handles new pickaxe with unset field)
        user.pickaxeDurability = Math.max(0, ((user.pickaxeDurability || pickaxe.durability) - 1));
        const pickBroke = user.pickaxeDurability === 0;

        const useBomb = consumeItem(user, 'mining_bomb');
        await user.save();

        cooldowns.mine.set(cdKey, now);

        const tiles    = buildTiles(tier.dist);
        const revealed = Array(16).fill(false);
        let earned     = 0;
        let caveins    = 0;
        let gameOver   = false;

        if (useBomb) {
            const safeIndices = tiles
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => t !== 'empty' && t !== 'cavein' && ORES[t].max > 0)
                .map(({ i }) => i)
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
            for (const idx of safeIndices) {
                revealed[idx] = true;
                earned += Math.floor(rand(ORES[tiles[idx]].min, ORES[tiles[idx]].max) * pickMulti);
            }
        }

        const extras = [
            `${pickaxe.name} (${user.pickaxeDurability} sessions left)`,
            hasBackpack ? 'Backpack' : null,
            useBomb ? 'Bomb used' : null,
        ].filter(Boolean).join(' · ');

        const brokeNote = pickBroke ? `\n\n*Your **${pickaxe.name}** broke - buy a new one from \`/shop\`.*` : '';

        const mineBody = (state = 'mining') => {
            if (state === 'mining') return (
                `Ore found: **$${formatNumber(earned)}**` +
                (caveins > 0 ? `  ·  Cave-ins: ${caveins} (-${Math.round(caveinLoss * 100)}% each)` : '') +
                '\n\nClick tiles to mine. Cash out anytime.' +
                (nextTier ? `\n\n*Upgrade to **${nextPickaxe?.name ?? 'the next pickaxe'}** to mine the **${nextTier.label}**.*` : '')
            );
            if (state === 'cashout') return `You hauled **$${formatNumber(earned)}** worth of ore out of the ${tier.label}.` + brokeNote;
            if (state === 'cleared') return `Every vein mined in the ${tier.label}!\n\nTotal haul: **$${formatNumber(earned)}**` + brokeNote;
            if (state === 'timeout') return `Session timed out. Ore collected: **$${formatNumber(earned)}**` + brokeNote;
        };

        const mineTitle = (state = 'mining') => ({
            mining:  `Mining - ${tier.label}`,
            cashout: `Mining Complete - ${tier.label}`,
            cleared: `Mine Cleared! - ${tier.label}`,
            timeout: `Session Expired - ${tier.label}`,
        }[state]);

        const finish = async (state, j = null) => {
            gameOver = true;
            gameCollector.stop(state);
            if (pickBroke) user.inventory = (user.inventory || []).filter(i => i.item !== pickaxe.id);
            if (earned > 0) user.balance = parseFloat((user.balance + earned).toFixed(2));
            await user.save();
            const footer = earned > 0 ? `New balance: $${formatNumber(user.balance)}` : null;
            const panel  = buildPanel(mineTitle(state), mineBody(state), footer, buildGrid(tiles, revealed, earned, true, true));
            if (j) await j.update(panel);
            else await msg.edit(panel).catch(() => {});
        };

        const msg = await interaction.reply({
            ...buildPanel(mineTitle(), mineBody(), extras, buildGrid(tiles, revealed, earned, false)),
            fetchReply: true,
        });

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
                // Cave-in also damages the pickaxe extra
                user.pickaxeDurability = Math.max(0, (user.pickaxeDurability ?? 0) - 3);
                await user.save();
                await j.update(buildPanel(mineTitle(), mineBody(), extras, buildGrid(tiles, revealed, earned, false)));
                return;
            }

            const ore = ORES[type];
            if (ore.max > 0) earned += Math.floor(rand(ore.min, ore.max) * pickMulti);

            const allMined = tiles.every((t, i) => t === 'empty' || t === 'cavein' || revealed[i]);
            if (allMined) { await finish('cleared', j); return; }

            await j.update(buildPanel(mineTitle(), mineBody(), extras, buildGrid(tiles, revealed, earned, false)));
        });

        gameCollector.on('end', async (_, reason) => { if (!gameOver) await finish('timeout'); });
    }
};
