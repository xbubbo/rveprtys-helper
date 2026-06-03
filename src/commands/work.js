const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');
const Slave = require('../models/slave');
const { formatNumber } = require('../utils/format');

const COOLDOWN = 2 * 60 * 1000;

const JOBS = [
    { id: 'intern',             title: 'Intern',             tier: 1, multiplier: 1.0,  requiresBalance: 0,          requiresPrestige: 0 },
    { id: 'greeting_person',    title: 'Greeting Person',    tier: 2, multiplier: 1.15, requiresBalance: 1_000,      requiresPrestige: 0 },
    { id: 'low_level_employee', title: 'Low Level Employee', tier: 3, multiplier: 1.35, requiresBalance: 10_000,     requiresPrestige: 0 },
    { id: 'head_of_low_level',  title: 'Head of Low Level',  tier: 4, multiplier: 1.6,  requiresBalance: 50_000,     requiresPrestige: 0 },
    { id: 'mid_level_employee', title: 'Mid Level Employee', tier: 5, multiplier: 1.9,  requiresBalance: 150_000,    requiresPrestige: 1 },
    { id: 'head_of_mid_level',  title: 'Head of Mid Level',  tier: 6, multiplier: 2.3,  requiresBalance: 400_000,    requiresPrestige: 1 },
    { id: 'executive',          title: 'Executive',          tier: 7, multiplier: 2.8,  requiresBalance: 1_000_000,  requiresPrestige: 2 },
    { id: 'head_of_hr',         title: 'Head of HR',         tier: 8, multiplier: 3.5,  requiresBalance: 5_000_000,  requiresPrestige: 3 },
    { id: 'board_of_directors', title: 'Board of Directors', tier: 9, multiplier: 5.0,  requiresBalance: 15_000_000, requiresPrestige: 4 },
];

function getJob(id) { return JOBS.find(j => j.id === id) || null; }
function getJobByTier(tier) { return JOBS.find(j => j.tier === tier) || null; }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work or manage your job at Economic Bomb Industries')
        .addSubcommand(sub => sub
            .setName('work')
            .setDescription('Earn some money'))
        .addSubcommand(sub => sub
            .setName('jobs')
            .setDescription('View all jobs and your eligibility'))
        .addSubcommand(sub => sub
            .setName('apply')
            .setDescription('Apply for a job')
            .addIntegerOption(opt =>
                opt.setName('tier')
                    .setDescription('Job tier (1-9)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(9)
            )),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const prestige = user.prestige || 0;
        const prestigeMult = user.prestigeMultiplier || 1;
        const jobMult = user.jobMultiplier || 1;
        const totalMult = parseFloat((prestigeMult * jobMult).toFixed(2));
        const currentJob = user.jobId ? getJob(user.jobId) : null;

        if (sub === 'work') {
            const now = Date.now();

            if (user.lastWork && now - user.lastWork < COOLDOWN) {
                const left = COOLDOWN - (now - user.lastWork);
                const s = Math.ceil(left / 1000);
                return interaction.reply({ content: `⏳ You need to wait **${s}s** before working again.`, ephemeral: true });
            }

            const base = Math.floor(Math.random() * 76) + 25;
            const amount = Math.floor(base * totalMult);
            user.lastWork = now;

            const slave = await Slave.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });

            if (slave?.ownerId) {
                slave.debt = parseFloat((slave.debt - amount).toFixed(2));
                slave.totalEarned = parseFloat((slave.totalEarned + amount).toFixed(2));

                const owner = await getUser(slave.ownerId, interaction.guild.id);
                owner.balance = parseFloat((owner.balance + amount).toFixed(2));
                await owner.save();

                if (slave.debt <= 0) {
                    const freedOwnerId = slave.ownerId;
                    slave.ownerId = null;
                    slave.debt = 0;
                    await slave.save();
                    await user.save();
                    try {
                        const ownerUser = await interaction.client.users.fetch(freedOwnerId);
                        await ownerUser.send({
                            embeds: [new EmbedBuilder()
                                .setTitle('Slave Debt Paid Off')
                                .setDescription(`<@${interaction.user.id}> has paid off their debt and is now free.`)
                                .setColor(0x00FF99)]
                        });
                    } catch {}
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setTitle('You Are Free!')
                            .setDescription(`You worked and earned **$${formatNumber(amount)}** - your debt is fully paid off!`)
                            .setColor(0x00FF99)]
                    });
                }

                await slave.save();
                await user.save();
                try {
                    const ownerUser = await interaction.client.users.fetch(slave.ownerId);
                    await ownerUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('Your Slave Worked!')
                            .setDescription(`<@${interaction.user.id}> earned **$${formatNumber(amount)}** for you.\nRemaining debt: **$${formatNumber(slave.debt)}**`)
                            .setColor(0x2b2d31)]
                    });
                } catch {}
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Work Complete')
                        .setDescription(`You earned **$${formatNumber(amount)}** - but it went to your owner <@${slave.ownerId}>.`)
                        .addFields({ name: 'Debt Remaining', value: `$${formatNumber(slave.debt)}`, inline: true })
                        .setColor(0xFF4500)
                        .setFooter({ text: 'Keep working to pay off your debt!' })]
                });
            }

            user.balance += amount;
            await user.save();
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

            const footerParts = [];
            if (currentJob) footerParts.push(`${currentJob.title} x${jobMult}`);
            if (user.prestige > 0) footerParts.push(`Prestige x${prestigeMult}`);
            if (footerParts.length > 1) footerParts.push(`Total x${totalMult}`);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Work Complete')
                    .setDescription(`You earned **$${formatNumber(amount)}**`)
                    .setColor(0x00cc44)
                    .setFooter({ text: footerParts.join(' • ') || 'Economic Bomb Industries' })]
            });
        }

        if (sub === 'jobs') {
            const totalBalance = user.balance + user.bank;

            const lines = JOBS.map(job => {
                const isCurrent = job.id === user.jobId;
                const meetsBalance = totalBalance >= job.requiresBalance;
                const meetsPrestige = prestige >= job.requiresPrestige;

                let status;
                if (isCurrent) status = '✅ Current';
                else if (!meetsBalance) status = `❌ Need $${formatNumber(job.requiresBalance)}`;
                else if (!meetsPrestige) status = `❌ Need Prestige ${job.requiresPrestige}`;
                else status = '✓ Available';

                return `**Tier ${job.tier} - ${job.title}**\nMultiplier: x${job.multiplier} | ${status}`;
            }).join('\n\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Economic Bomb Industries - Job Board')
                    .setDescription(
                        (currentJob
                            ? `**Current Job:** ${currentJob.title} (x${currentJob.multiplier} multiplier)\n\n`
                            : `**Current Job:** Unemployed\n\n`)
                        + lines
                    )
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Use /work apply <tier> to apply • Requirements use wallet + bank combined' })]
            });
        }

        if (sub === 'apply') {
            const tier = interaction.options.getInteger('tier');
            const job = getJobByTier(tier);
            const totalBalance = user.balance + user.bank;

            if (!job) return interaction.reply({ content: '❌ Invalid tier.', ephemeral: true });
            if (user.jobId === job.id) return interaction.reply({ content: `❌ You are already a **${job.title}**.`, ephemeral: true });

            if (totalBalance < job.requiresBalance) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Application Denied')
                        .setDescription(`**${job.title}** requires **$${formatNumber(job.requiresBalance)}** (wallet + bank).\nYou have **$${formatNumber(totalBalance)}**.`)
                        .setColor(0xff0000)],
                    ephemeral: true
                });
            }

            if (prestige < job.requiresPrestige) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('Application Denied')
                        .setDescription(`**${job.title}** requires **Prestige ${job.requiresPrestige}**.\nYou are Prestige **${prestige}**.`)
                        .setColor(0xff0000)],
                    ephemeral: true
                });
            }

            const prevJob = user.jobId ? getJob(user.jobId) : null;
            user.jobId = job.id;
            user.jobMultiplier = job.multiplier;
            await user.save();

            const newTotal = parseFloat((job.multiplier * prestigeMult).toFixed(2));

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Application Accepted!')
                    .setDescription(
                        `Welcome to **${job.title}** at Economic Bomb Industries!\n\n` +
                        (prevJob ? `Previous role: ${prevJob.title}\n\n` : '')
                    )
                    .addFields(
                        { name: 'Job Multiplier', value: `x${job.multiplier}`, inline: true },
                        { name: 'Prestige Multiplier', value: `x${prestigeMult}`, inline: true },
                        { name: 'Total Work Multiplier', value: `x${newTotal}`, inline: true }
                    )
                    .setColor(0x00FF99)
                    .setFooter({ text: 'Economic Bomb Industries • Your new multiplier applies to all future work' })]
            });
        }
    }
};
