const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN = 10 * 60 * 1000;
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Try to rob another user')
        .addUserOption(option =>
            option.setName('target').setDescription('User to rob').setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const now    = Date.now();

        if (target.id === interaction.user.id)
            return interaction.reply({ content: "❌ You can't rob yourself.", ephemeral: true });

        if (cooldowns.rob.has(interaction.user.id)) {
            const exp = cooldowns.rob.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cooldowns.rob.set(interaction.user.id, now);

        const user   = await getUser(interaction.user.id, interaction.guild.id);
        const victim = await getUser(target.id,           interaction.guild.id);

        if (victim.balance < 50)
            return interaction.reply({ content: '❌ Target is too poor to rob.', ephemeral: true });

        const victimTotal = victim.balance + victim.bank;
        if (victimTotal > user.balance * 5)
            return interaction.reply({ content: '❌ This target is too powerful to rob.', ephemeral: true });

        let successChance = 0.6;
        if (victimTotal > 1000)  successChance = 0.5;
        if (victimTotal > 5000)  successChance = 0.4;
        if (victimTotal > 10000) successChance = 0.3;
        if (victimTotal > 25000) successChance = 0.2;
        if (victimTotal > 50000) successChance = 0.1;

        if (Math.random() < successChance) {
            const amount = parseFloat(Math.min(victim.balance * (0.15 + Math.random() * 0.15), 4000).toFixed(2));
            victim.balance = parseFloat((victim.balance - amount).toFixed(2));
            user.balance   = parseFloat((user.balance   + amount).toFixed(2));
            await user.save();
            await victim.save();
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Rob Success')
                .setDescription(`You stole **$${fmt(amount)}** from <@${target.id}>`)
                .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                .setColor(0x00ff00)] });
        } else {
            const penalty = parseFloat(Math.max(user.balance * 0.15, 200).toFixed(2));
            user.balance = parseFloat((user.balance - penalty).toFixed(2));
            await user.save();
            return interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle('Rob Failed')
                .setDescription(`You got caught and lost **$${fmt(penalty)}**`)
                .setFooter({ text: `Success chance: ${Math.round(successChance * 100)}%` })
                .setColor(0xff0000)] });
        }
    }
};
