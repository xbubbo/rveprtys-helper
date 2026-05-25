const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Challenge someone to a duel')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Choose your opponent')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.user;
        const opponent = interaction.options.getUser('opponent');

        if (opponent.bot) {
            return interaction.reply({
                content: "You can't duel bots.",
                ephemeral: true
            });
        }

        if (opponent.id === user.id) {
            return interaction.reply({
                content: "You can't duel yourself.",
                ephemeral: true
            });
        }

        const participants = [user, opponent];
        const winner = participants[Math.floor(Math.random() * participants.length)];

        const embed = new EmbedBuilder()
            .setTitle('⚔️ Duel Result')
            .setDescription(
                `🥊 ${user.username} vs ${opponent.username}\n\n` +
                `🏆 Winner: **${winner.username}**`
            )
            .setColor(0x2b2d31);

        await interaction.reply({ embeds: [embed] });
    }
};
