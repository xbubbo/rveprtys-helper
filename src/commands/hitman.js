const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const { safeDM } = require('../utils/Safedm');

const COOLDOWN = 30 * 60 * 1000;
const hitmanCooldowns = new Map();

const TIERS = [
    { name: 'Street Thug',    cost: 5_000,    successRate: 0.35, penalty: 0.05 },
    { name: 'Enforcer',       cost: 25_000,   successRate: 0.55, penalty: 0.10 },
    { name: 'Professional',   cost: 100_000,  successRate: 0.72, penalty: 0.18 },
    { name: 'Ghost Operative',cost: 500_000,  successRate: 0.88, penalty: 0.28 },
];

const OUTCOMES = [
    'froze their account for 1 hour',
    'destroyed their daily streak',
    'wiped their work cooldown progress',
    'seized funds from their wallet',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hitman')
        .setDescription('Hire a hitman to sabotage another player')
        .addUserOption(o => o.setName('target').setDescription('Who to hit').setRequired(true))
        .addIntegerOption(o =>
            o.setName('tier')
                .setDescription('Hitman tier (1-4). Higher tier costs more but succeeds more often.')
                .setRequired(true)
                .addChoices(
                    { name: 'Street Thug - $5,000', value: 1 },
                    { name: 'Enforcer - $25,000', value: 2 },
                    { name: 'Professional - $100,000', value: 3 },
                    { name: 'Ghost Operative - $500,000', value: 4 },
                )
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const tierIndex = interaction.options.getInteger('tier') - 1;
        const tier = TIERS[tierIndex];
        const now = Date.now();

        if (target.id === interaction.user.id)
            return interaction.reply({ content: 'You cannot hire a hitman on yourself.', ephemeral: true });
        if (target.bot)
            return interaction.reply({ content: 'Bots cannot be targeted.', ephemeral: true });

        const cooldownKey = `${interaction.user.id}-${interaction.guild.id}`;
        if (hitmanCooldowns.has(cooldownKey)) {
            const exp = hitmanCooldowns.get(cooldownKey) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000);
                const s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `You already have an active contract. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }

        const hirer = await getUser(interaction.user.id);
        if (hirer.balance < tier.cost)
            return interaction.reply({ content: `You need **$${formatNumber(tier.cost)}** to hire a ${tier.name}. You have **$${formatNumber(hirer.balance)}**.`, ephemeral: true });

        hirer.balance = parseFloat((hirer.balance - tier.cost).toFixed(2));
        await hirer.save();
        hitmanCooldowns.set(cooldownKey, now);

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('Contract Placed')
                .setDescription(`A ${tier.name} has been hired against <@${target.id}>.\n\n**$${formatNumber(tier.cost)}** deducted. Stand by.`)
                .addFields(
                    { name: 'Target', value: `<@${target.id}>`, inline: true },
                    { name: 'Operative', value: tier.name, inline: true },
                    { name: 'Success Rate', value: `${Math.round(tier.successRate * 100)}%`, inline: true }
                )
                .setColor(0x2b2d31)
                .setFooter({ text: 'Result incoming...' })]
        });

        await new Promise(r => setTimeout(r, 3500));

        const victim = await getUser(target.id);
        const success = Math.random() < tier.successRate;

        if (success) {
            const penaltyAmount = parseFloat((victim.balance * tier.penalty).toFixed(2));
            const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)];

            victim.balance = Math.max(0, parseFloat((victim.balance - penaltyAmount).toFixed(2)));

            if (outcome === 'destroyed their daily streak') {
                victim.dailyStreak = 0;
            } else if (outcome === 'wiped their work cooldown progress') {
                victim.lastWork = now - 1;
            }

            await victim.save();

            await interaction.followUp({
                embeds: [new EmbedBuilder()
                    .setTitle('Hit Confirmed')
                    .setDescription(`The operative reached <@${target.id}> and ${outcome}.`)
                    .addFields(
                        { name: 'Funds Seized', value: `$${formatNumber(penaltyAmount)}`, inline: true },
                        { name: 'Their New Balance', value: `$${formatNumber(victim.balance)}`, inline: true }
                    )
                    .setColor(0x00cc44)]
            });

            await safeDM(interaction.client, target.id, {
                embeds: [new EmbedBuilder()
                    .setTitle('You Were Hit')
                    .setDescription(`Someone put a contract on you in **${interaction.guild.name}**.\n\nAn operative ${outcome} and seized **$${formatNumber(penaltyAmount)}** from your wallet.`)
                    .setColor(0xff0000)]
            });

        } else {
            const blowbackAmount = parseFloat((hirer.balance * 0.05).toFixed(2));
            const hirerFresh = await getUser(interaction.user.id);
            hirerFresh.balance = Math.max(0, parseFloat((hirerFresh.balance - blowbackAmount).toFixed(2)));
            await hirerFresh.save();

            await interaction.followUp({
                embeds: [new EmbedBuilder()
                    .setTitle('Contract Failed')
                    .setDescription(`The operative was neutralized before reaching <@${target.id}>.\n\nBlowback cost you **$${formatNumber(blowbackAmount)}**.`)
                    .addFields({ name: 'Your Balance', value: `$${formatNumber(hirerFresh.balance)}`, inline: true })
                    .setColor(0xff0000)]
            });
        }
    }
};