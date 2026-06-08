const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { applyDeathPenalty } = require('../../utils/penalty');
const cooldowns = require('../../utils/cooldowns');
const { formatNumber } = require('../../utils/format');

const COOLDOWN = 30 * 60 * 1000;

const CRIMES = [
    { emoji: '🤏', label: 'Pickpocket',   min: 150,   max: 600,   deathChance: 0.04, catchChance: 0.18, fine: 0.28, failChance: 0.12, failPenalty: 0,   failMsg: 'You attempted to pickpocket someone but your pants fell down and they got away.' },
    { emoji: '🛍️', label: 'Shoplift',     min: 300,   max: 1000,  deathChance: 0.05, catchChance: 0.22, fine: 0.32, failChance: 0.12, failPenalty: 0,   failMsg: 'You stole a pack of gum from Walmart and were immediately arrested.' },
    { emoji: '🚙', label: 'Carjack',      min: 800,   max: 2500,  deathChance: 0.09, catchChance: 0.27, fine: 0.38, failChance: 0.18, failPenalty: 0,   failMsg: "You tried carjacking someone but you don't know how to drive and failed." },
    { emoji: '🔪', label: 'Mugging',      min: 1000,  max: 4000,  deathChance: 0.12, catchChance: 0.30, fine: 0.42, failChance: 0.18, failPenalty: 0,   failMsg: "You tried mugging someone but you don't even go outside." },
    { emoji: '💳', label: 'Fraud',        min: 1500,  max: 6000,  deathChance: 0.04, catchChance: 0.35, fine: 0.45, failChance: 0.18, failPenalty: 500, failMsg: 'You committed fraud in your own name and lost $500.' },
    { emoji: '🏦', label: 'Bank Robbery', min: 5000,  max: 18000, deathChance: 0.20, catchChance: 0.45, fine: 0.55, failChance: 0.22, failPenalty: 0,   failMsg: 'All of the money you stole was fake, you idiot.' },
];

const DEATH_MSGS = [
    'The mark fought back harder than expected.',
    'A bystander called the cops and things escalated.',
    'You ran into the wrong people.',
    'It was a setup from the start.',
    'Security was waiting for you.',
];

const CAUGHT_MSGS = [
    'You almost got away with it, but got caught at the last second.',
    'An off-duty officer spotted you.',
    'A camera caught everything.',
    'Someone recognized you and called it in.',
];

const SUCCESS_MSGS = [
    'Clean getaway.',
    'Nobody even noticed.',
    'In and out, just like that.',
    'Professional.',
    'Too easy.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a random crime - high risk, high reward'),

    async execute(interaction) {
        const now = Date.now();

        if (cooldowns.crime.has(interaction.user.id)) {
            const exp = cooldowns.crime.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ Laying low. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.crime.set(interaction.user.id, now);

        const c    = pick(CRIMES);
        const user = await getUser(interaction.user.id);

        if (Math.random() < c.deathChance) {
            const result = await applyDeathPenalty(user);
            const msg    = pick(DEATH_MSGS);

            if (result.blocked) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(`${c.emoji} ${c.label} - Barely Survived`)
                    .setDescription(`${msg}\n\n🛟 **Your lifesaver saved you!** No money was lost.`)
                    .setColor(0xFFD700)] });
            }

            const lostStr = result.from === 'wallet'
                ? `**$${formatNumber(result.penalty)}** from your wallet (2%)`
                : `**$${formatNumber(result.penalty)}** from your bank (4%)`;

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`☠️ ${c.label} Gone Wrong`)
                .setDescription(`${msg}\n\nYou lost ${lostStr}.`)
                .setColor(0xff3333)] });
        }

        if (Math.random() < c.failChance) {
            if (c.failPenalty > 0) {
                const lost = Math.min(c.failPenalty, user.balance);
                user.balance = parseFloat((user.balance - lost).toFixed(2));
                await user.save();
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(`${c.emoji} ${c.label} - Failed`)
                    .setDescription(c.failMsg)
                    .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                    .setColor(0xff8800)] });
            }
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${c.emoji} ${c.label} - Failed`)
                .setDescription(c.failMsg)
                .setColor(0xff8800)] });
        }

        if (Math.random() < c.catchChance) {
            const potential = Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;
            const fine      = parseFloat((potential * c.fine).toFixed(2));
            const actual    = Math.min(fine, user.balance);
            user.balance    = parseFloat((user.balance - actual).toFixed(2));
            await user.save();

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`🚨 Caught - ${c.label}`)
                .setDescription(`${pick(CAUGHT_MSGS)}\n\nYou paid a **$${formatNumber(actual)}** fine.`)
                .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                .setColor(0xff8800)] });
        }

        const amount = Math.floor(Math.random() * (c.max - c.min + 1)) + c.min;
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${c.emoji} ${c.label} - Success`)
            .setDescription(`${pick(SUCCESS_MSGS)} You walked away with **$${formatNumber(amount)}**.`)
            .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
            .setColor(0x00cc44)] });
    }
};
