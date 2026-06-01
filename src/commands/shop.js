const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

const ITEMS = {
    lifesaver: {
        emoji: '🛟',
        name: 'Lifesaver',
        price: 5000,
        description: 'Prevents the death penalty once. When consumed by death, grants a 5-minute +5% gambling win boost.',
    },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy items and view your inventory')
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Browse available items and view your inventory')
        )
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item')
                .addStringOption(o =>
                    o.setName('item').setDescription('Item to buy').setRequired(true)
                        .addChoices({ name: 'Lifesaver ($5,000)', value: 'lifesaver' })
                )
                .addIntegerOption(o =>
                    o.setName('quantity').setDescription('How many to buy (default: 1)').setRequired(false).setMinValue(1).setMaxValue(99)
                )
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);

        if (sub === 'browse') {
            const shopLines = Object.entries(ITEMS).map(([key, item]) => {
                const owned = user.inventory?.find(i => i.item === key)?.quantity ?? 0;
                return `${item.emoji} **${item.name}** - $${fmtInt(item.price)}\n> ${item.description}\n> You own: **${owned}**`;
            }).join('\n\n');

            const invLines = user.inventory?.length
                ? user.inventory.map(i => {
                    const item = ITEMS[i.item];
                    return `${item?.emoji ?? '📦'} **${item?.name ?? i.item}** x${i.quantity}`;
                }).join('\n')
                : 'Your inventory is empty.';

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('🏪 Shop')
                .addFields(
                    { name: '🛒 Available Items', value: shopLines,  inline: false },
                    { name: '🎒 Your Inventory',  value: invLines,   inline: false },
                )
                .setColor(0x5865F2)
                .setFooter({ text: 'Use /shop buy <item> to purchase' })] });
        }

        if (sub === 'buy') {
            const key      = interaction.options.getString('item');
            const quantity = interaction.options.getInteger('quantity') ?? 1;
            const item     = ITEMS[key];
            const total    = item.price * quantity;

            if (user.balance < total)
                return interaction.reply({ content: `❌ You need **$${fmt(total)}** but only have **$${fmt(user.balance)}**.`, ephemeral: true });

            user.balance = parseFloat((user.balance - total).toFixed(2));

            const existing = user.inventory?.find(i => i.item === key);
            if (existing) {
                existing.quantity += quantity;
            } else {
                if (!user.inventory) user.inventory = [];
                user.inventory.push({ item: key, quantity });
            }

            await user.save();

            const owned = user.inventory.find(i => i.item === key)?.quantity ?? quantity;

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${item.emoji} Purchase Successful`)
                .setDescription(`You bought **${quantity}x ${item.name}** for **$${fmt(total)}**.`)
                .addFields(
                    { name: '💵 Balance',   value: `$${fmt(user.balance)}`, inline: true },
                    { name: '🎒 Now Owned', value: `${owned}x`,             inline: true },
                )
                .setColor(0x00cc44)] });
        }
    }
};
