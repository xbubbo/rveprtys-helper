const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const COOLDOWN = 60 * 1000; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Earn some money'),

    async execute(interaction) {
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now = Date.now();


        if (user.lastWork && now - user.lastWork < COOLDOWN) {
            const timeLeft = ((COOLDOWN - (now - user.lastWork)) / 1000).toFixed(1);

            return interaction.reply({
                content: `⏳ You need to wait ${timeLeft}s before working again.`,
                ephemeral: true
            });
        }


        const amount = Math.floor(Math.random() * 200) + 50;

        user.balance += amount;
        user.lastWork = now;

        await user.save();

        const embed = new EmbedBuilder()
            .setTitle('💼 Work Complete')
            .setDescription(`You earned **$${amount}**`)
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [embed] });
    }
};
