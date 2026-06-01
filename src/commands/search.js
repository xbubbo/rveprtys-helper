const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');
const { applyDeathPenalty } = require('../utils/penalty');
const cooldowns = require('../utils/cooldowns');

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString('en-US');

const COOLDOWN = 30 * 60 * 1000;

const LOCATIONS = {
    couch:               { emoji: '🛋️',  min: 25,   max: 75,   deathChance: 0.05, label: 'Behind the Couch' },
    car:                 { emoji: '🚗',  min: 100,  max: 350,  deathChance: 0.08, label: 'Abandoned Car' },
    house:               { emoji: '🏠',  min: 75,   max: 200,  deathChance: 0.06, label: 'Empty House' },
    park:                { emoji: '🌳',  min: 50,   max: 250,  deathChance: 0.10, label: 'Local Park' },
    dumpster:            { emoji: '🗑️',  min: 50,   max: 300,  deathChance: 0.15, label: 'Dumpster' },
    street:              { emoji: '🌆',  min: 100,  max: 500,  deathChance: 0.22, label: 'Dark Street' },
    alley:               { emoji: '🌃',  min: 150,  max: 700,  deathChance: 0.30, label: 'Back Alley' },
    abandoned_building:  { emoji: '🏚️',  min: 200,  max: 1000, deathChance: 0.40, label: 'Abandoned Building' },
    bank_vault:          { emoji: '🏦',  min: 500,  max: 2500, deathChance: 0.55, label: 'Bank Vault' },
    area_51:             { emoji: '👽',  min: 1000, max: 6000, deathChance: 0.70, label: 'Area 51' },
};

const DEATH_MESSAGES = [
    'You were spotted by security and things went south fast.',
    'You tripped into a pit and never came back.',
    'Someone really did not like you snooping around.',
    'You found something you were not supposed to find.',
    'The place was booby-trapped. Lesson learned.',
    'You got mugged on the way back.',
];

const FIND_MESSAGES = [
    'You dug around and found',
    'Hidden under some debris you discovered',
    'Jackpot - tucked away was',
    'After some careful searching you walked away with',
    'You struck lucky and pocketed',
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search a location for money')
        .addStringOption(o =>
            o.setName('location').setDescription('Where to search').setRequired(true)
                .addChoices(
                    { name: 'Behind the Couch',   value: 'couch'              },
                    { name: 'Abandoned Car',       value: 'car'                },
                    { name: 'Empty House',         value: 'house'              },
                    { name: 'Local Park',          value: 'park'               },
                    { name: 'Dumpster',            value: 'dumpster'           },
                    { name: 'Dark Street',         value: 'street'             },
                    { name: 'Back Alley',          value: 'alley'              },
                    { name: 'Abandoned Building',  value: 'abandoned_building' },
                    { name: 'Bank Vault',          value: 'bank_vault'         },
                    { name: 'Area 51',             value: 'area_51'            }
                )
        ),

    async execute(interaction) {
        const key  = interaction.options.getString('location');
        const loc  = LOCATIONS[key];
        const cdKey = `${interaction.user.id}-${key}`;
        const now  = Date.now();

        if (cooldowns.search.has(cdKey)) {
            const exp = cooldowns.search.get(cdKey) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const totalSecs = Math.ceil(left / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ You already searched the **${loc.label}**. Try again in **${m}m ${s}s**.`, ephemeral: true });
            }
        }
        cooldowns.search.set(cdKey, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);

        if (Math.random() < loc.deathChance) {
            const result = await applyDeathPenalty(user);
            const msg    = DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];

            if (result.blocked) {
                return interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(`${loc.emoji} Close Call at the ${loc.label}`)
                    .setDescription(`${msg}\n\n🛟 **Your lifesaver saved you!** No money was lost.`)
                    .setColor(0xFFD700)] });
            }

            const lostStr = result.from === 'wallet'
                ? `**$${fmt(result.penalty)}** from your wallet (2%)`
                : `**$${fmt(result.penalty)}** from your bank (4%)`;

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`☠️ Didn't Make It Out of the ${loc.label}`)
                .setDescription(`${msg}\n\nYou lost ${lostStr}.`)
                .setColor(0xff3333)] });
        }

        const amount = Math.floor(Math.random() * (loc.max - loc.min + 1)) + loc.min;
        user.balance = parseFloat((user.balance + amount).toFixed(2));
        await user.save();

        const findMsg = FIND_MESSAGES[Math.floor(Math.random() * FIND_MESSAGES.length)];

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`${loc.emoji} ${loc.label}`)
            .setDescription(`${findMsg} **$${fmtInt(amount)}**!`)
            .addFields({ name: '💵 New Balance', value: `$${fmt(user.balance)}`, inline: true })
            .setColor(0x00cc44)
            .setFooter({ text: `Death chance: ${Math.round(loc.deathChance * 100)}% • Cooldown: 30 minutes` })] });
    }
};
