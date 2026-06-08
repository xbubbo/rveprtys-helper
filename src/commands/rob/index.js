const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const cooldowns = require('../../utils/cooldowns');
const { formatNumber } = require('../../utils/format');

const COOLDOWN = 10 * 60 * 1000;

function successChanceFor(victimTotal) {
    if (victimTotal > 50000) return 0.10;
    if (victimTotal > 25000) return 0.20;
    if (victimTotal > 10000) return 0.30;
    if (victimTotal > 5000)  return 0.40;
    if (victimTotal > 1000)  return 0.50;
    return 0.60;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Try to rob another user')
        .addUserOption(o =>
            o.setName('target').setDescription('User to rob').setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const now    = Date.now();

        if (target.id === interaction.user.id)
            return interaction.reply({ content: "❌ You can't rob yourself.", ephemeral: true });

        if (cooldowns.rob.has(interaction.user.id)) {
            const exp = cooldowns.rob.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const totalSecs = Math.ceil((exp - now) / 1000);
                const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cooldowns.rob.set(interaction.user.id, now);

        const user   = await getUser(interaction.user.id);
        const victim = await getUser(target.id);

        if (victim.balance < 50)
            return interaction.reply({ content: '❌ Target is too poor to rob.', ephemeral: true });

        const victimTotal    = victim.balance + victim.bank;
        const successChance  = successChanceFor(victimTotal);

        if (victimTotal > user.balance * 5)
            return interaction.reply({ content: '❌ This target is too powerful to rob.', ephemeral: true });

        if (Math.random() < successChance) {
            const amount = parseFloat(Math.min(victim.balance * (0.15 + Math.random() * 0.15), 4000).toFixed(2));
            victim.balance = parseFloat((victim.balance - amount).toFixed(2));
            user.balance   = parseFloat((user.balance   + amount).toFixed(2));
            await user.save();
            await victim.save();
            await anticheat(interaction.client, interaction.user.id);
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🥷 Rob Successful')
                    .setDescription(`You stole **$${formatNumber(amount)}** from <@${target.id}>!`)
                    .addFields({ name: '💵 Your Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                    .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                    .setColor(0x00cc44)]
            });
        }

        const penalty  = parseFloat(Math.max(user.balance * 0.15, 200).toFixed(2));
        user.balance   = parseFloat((user.balance - penalty).toFixed(2));
        await user.save();
        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🚨 Caught!')
                .setDescription(`You got caught trying to rob <@${target.id}> and lost **$${formatNumber(penalty)}**.`)
                .addFields({ name: '💵 Your Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                .setColor(0xff3333)]
        });
    }
};
