const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const Slave = require('../../models/slave');
const { formatNumber } = require('../../utils/format');

const CORPORATE_COOLDOWN = 2 * 60 * 1000;

const CORPORATE_JOBS = [
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

function getCorporateJob(id) { return CORPORATE_JOBS.find(j => j.id === id) || null; }
function findJob(id)         { return getCorporateJob(id) || null; }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work your current job or manage your career')
        .addSubcommand(sub => sub
            .setName('work')
            .setDescription('Do your job'))
        .addSubcommand(sub => sub
            .setName('jobs')
            .setDescription('Browse all available jobs'))
        .addSubcommand(sub => sub
            .setName('apply')
            .setDescription('Apply for a job')
            .addStringOption(opt =>
                opt.setName('job')
                    .setDescription('Job to apply for')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Tier 1: Intern (1x)',               value: 'intern'             },
                        { name: 'Tier 2: Greeting Person (1.15x)',   value: 'greeting_person'    },
                        { name: 'Tier 3: Low Level Employee (1.35x)',value: 'low_level_employee' },
                        { name: 'Tier 4: Head of Low Level (1.6x)', value: 'head_of_low_level'  },
                        { name: 'Tier 5: Mid Level Employee (1.9x)', value: 'mid_level_employee' },
                        { name: 'Tier 6: Head of Mid Level (2.3x)', value: 'head_of_mid_level'  },
                        { name: 'Tier 7: Executive (2.8x)',          value: 'executive'          },
                        { name: 'Tier 8: Head of HR (3.5x)',         value: 'head_of_hr'         },
                        { name: 'Tier 9: Board of Directors (5x)',   value: 'board_of_directors' },
                    )
            )),

    async execute(interaction) {
        const sub          = interaction.options.getSubcommand();
        const user         = await getUser(interaction.user.id);
        const prestige     = user.prestige          || 0;
        const prestigeMult = user.prestigeMultiplier || 1;
        const jobMult      = user.jobMultiplier      || 1;
        const currentJobId = user.jobId || null;
        const currentJob   = currentJobId ? findJob(currentJobId) : null;
        const totalWealth  = user.balance + user.bank;

        if (sub === 'work') {
            const now = Date.now();
            if (user.lastWork && now - user.lastWork < CORPORATE_COOLDOWN) {
                const s = Math.ceil((CORPORATE_COOLDOWN - (now - user.lastWork)) / 1000);
                return interaction.reply({ content: `⏳ You need to wait **${s}s** before working again.`, ephemeral: true });
            }

            const corporateJob = currentJobId ? getCorporateJob(currentJobId) : null;
            const totalMult    = parseFloat((prestigeMult * jobMult).toFixed(2));
            const amount       = Math.floor((Math.floor(Math.random() * 76) + 25) * totalMult);
            user.lastWork      = now;

            const slave = await Slave.findOne({ userId: interaction.user.id });

            if (slave?.ownerId) {
                slave.debt        = parseFloat((slave.debt - amount).toFixed(2));
                slave.totalEarned = parseFloat((slave.totalEarned + amount).toFixed(2));
                const owner       = await getUser(slave.ownerId);
                owner.balance     = parseFloat((owner.balance + amount).toFixed(2));
                await owner.save();

                if (slave.debt <= 0) {
                    const freedOwnerId = slave.ownerId;
                    slave.ownerId = null; slave.debt = 0;
                    await slave.save(); await user.save();
                    try { const u = await interaction.client.users.fetch(freedOwnerId); await u.send({ embeds: [new EmbedBuilder().setTitle('Slave Debt Paid Off').setDescription(`<@${interaction.user.id}> has paid off their debt and is now free.`).setColor(0x00FF99)] }); } catch {}
                    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('You Are Free!').setDescription(`You worked and earned **$${formatNumber(amount)}** - your debt is fully paid off!`).setColor(0x00FF99)] });
                }

                await slave.save(); await user.save();
                try { const u = await interaction.client.users.fetch(slave.ownerId); await u.send({ embeds: [new EmbedBuilder().setTitle('Your Slave Worked!').setDescription(`<@${interaction.user.id}> earned **$${formatNumber(amount)}** for you.\nRemaining debt: **$${formatNumber(slave.debt)}**`).setColor(0x2b2d31)] }); } catch {}
                return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Work Complete').setDescription(`You earned **$${formatNumber(amount)}** - but it went to your owner <@${slave.ownerId}>.`).addFields({ name: 'Debt Remaining', value: `$${formatNumber(slave.debt)}`, inline: true }).setColor(0xFF4500).setFooter({ text: 'Keep working to pay off your debt!' })] });
            }

            user.balance = parseFloat((user.balance + amount).toFixed(2));
            await user.save();
            await anticheat(interaction.client, interaction.user.id);

            const footerParts = [];
            if (corporateJob) footerParts.push(`${corporateJob.title} x${jobMult}`);
            if (prestige > 0) footerParts.push(`Prestige x${prestigeMult}`);
            if (footerParts.length > 1) footerParts.push(`Total x${totalMult}`);

            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Work Complete').setDescription(`You earned **$${formatNumber(amount)}**`).setColor(0x00cc44).setFooter({ text: footerParts.join(' • ') || 'Economic Bomb Industries' })] });
        }

        if (sub === 'jobs') {
            const lines = CORPORATE_JOBS.map(job => {
                const isCurrent    = job.id === currentJobId;
                const meetsBalance = totalWealth >= job.requiresBalance;
                const meetsPres    = prestige >= job.requiresPrestige;
                const status = isCurrent ? '✅ Current' : !meetsBalance ? `❌ Need $${formatNumber(job.requiresBalance)}` : !meetsPres ? `❌ Need Prestige ${job.requiresPrestige}` : '✓ Available';
                return `**Tier ${job.tier} - ${job.title}** (x${job.multiplier})\n${status}`;
            }).join('\n\n');

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Economic Bomb Industries - Job Board')
                    .setDescription(
                        `**Current Job:** ${currentJob?.title ?? 'Unemployed'}\n\n` +
                        `**Corporate Jobs** - passive income with multipliers\n${lines}\n\n` +
                        `*For activity jobs (/fish, /mine, /stream) buy the required gear from /shop.*`
                    )
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Use /work apply to switch jobs - Requirements use wallet + bank combined' })]
            });
        }

        if (sub === 'apply') {
            const jobId = interaction.options.getString('job');
            const job   = findJob(jobId);
            if (!job) return interaction.reply({ content: '❌ Invalid job.', ephemeral: true });
            if (currentJobId === jobId) return interaction.reply({ content: `❌ You are already a **${job.title}**.`, ephemeral: true });

            if (totalWealth < job.requiresBalance) return interaction.reply({
                embeds: [new EmbedBuilder().setTitle('Application Denied').setDescription(`**${job.title}** requires **$${formatNumber(job.requiresBalance)}** total wealth.\nYou have **$${formatNumber(totalWealth)}**.`).setColor(0xff0000)],
                ephemeral: true,
            });

            if (prestige < (job.requiresPrestige ?? 0)) return interaction.reply({
                embeds: [new EmbedBuilder().setTitle('Application Denied').setDescription(`**${job.title}** requires **Prestige ${job.requiresPrestige}**.\nYou are Prestige **${prestige}**.`).setColor(0xff0000)],
                ephemeral: true,
            });

            user.jobId         = job.id;
            user.jobMultiplier = job.multiplier ?? 1;
            await user.save();

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('Application Accepted!')
                    .setDescription(`Welcome to **${job.title}** at Economic Bomb Industries!\n\nNew work multiplier: **x${parseFloat((job.multiplier * prestigeMult).toFixed(2))}**`)
                    .setColor(0x00FF99)]
            });
        }
    }
};
