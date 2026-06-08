const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const cooldowns = require('../../utils/cooldowns');
const { formatNumber } = require('../../utils/format');

const COOLDOWN = 10 * 60 * 1000;

const OUTCOMES = [
    { chance: 0.08, amount: 0,          msg: 'Everyone walked past without a second glance.' },
    { chance: 0.22, range: [10, 30],    msg: 'A kid tossed you their leftover lunch money.' },
    { chance: 0.22, range: [30, 80],    msg: 'A kind stranger stopped and handed you some cash.' },
    { chance: 0.18, range: [80, 150],   msg: 'A generous person felt sorry for you.' },
    { chance: 0.12, range: [150, 300],  msg: 'Someone handed you a thick envelope.' },
    { chance: 0.09, range: [300, 600],  msg: 'A wealthy passerby took pity and was very generous.' },
    { chance: 0.06, range: [1000, 5000], msg: 'A billionaire saw you begging and handed you their spare change.' },
    { chance: 0.02, lifesaver: true,    msg: 'A paramedic rushed past and dropped something out of their bag...' },
    { chance: 0.01, range: [10000, 50000], jackpot: true, msg: 'A mysterious stranger in a suit handed you a briefcase and walked away without a word.' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for money from strangers'),

    async execute(interaction) {
        const now = Date.now();

        if (cooldowns.beg.has(interaction.user.id)) {
            const exp = cooldowns.beg.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ People are tired of seeing you beg. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.beg.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id);

        let roll    = Math.random();
        let outcome = OUTCOMES[OUTCOMES.length - 1];
        for (const o of OUTCOMES) {
            if (roll < o.chance) { outcome = o; break; }
            roll -= o.chance;
        }

        if (outcome.lifesaver) {
            const existing = user.inventory?.find(i => i.item === 'lifesaver');
            if (existing) existing.quantity++;
            else {
                if (!user.inventory) user.inventory = [];
                user.inventory.push({ item: 'lifesaver', quantity: 1 });
            }
            await user.save();

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🛟 What\'s This?')
                    .setDescription(`${outcome.msg}\n\nIt's a **Lifesaver**! Added to your inventory.`)
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Cooldown: 10 minutes' })]
            });
        }

        const amount = outcome.amount === 0
            ? 0
            : Math.floor(Math.random() * (outcome.range[1] - outcome.range[0] + 1)) + outcome.range[0];

        if (amount > 0) {
            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save();
        }

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle(outcome.jackpot ? '💼 What Just Happened?' : amount > 0 ? '🙏 Someone Helped' : '😔 No Luck')
                .setDescription(outcome.msg + (amount > 0 ? ` **+$${formatNumber(amount)}**` : ''))
                .addFields(amount > 0 ? [{ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }] : [])
                .setColor(outcome.jackpot ? 0xFFD700 : amount > 0 ? 0x00cc44 : 0x71717a)
                .setFooter({ text: 'Cooldown: 10 minutes' })]
        });
    }
};
