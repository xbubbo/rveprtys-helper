const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('DM a user by ID')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('User ID to DM')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message to send')
                .setRequired(true)
        ),

    async execute(interaction) {


        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "You are not allowed to use this command.",
                ephemeral: true
            });
        }

        const userId = interaction.options.getString('userid');
        const message = interaction.options.getString('message');

        try {
            const user = await interaction.client.users.fetch(userId);

            await user.send(message);

            await interaction.reply({
                content: `Message sent to ${user.tag}`,
                ephemeral: true
            });

        } catch (err) {
            await interaction.reply({
                content: "Failed to send DM. User may have DMs disabled.",
                ephemeral: true
            });
        }
    }
};
