async function execute(interaction) {
    const userId  = interaction.options.getString('userid');
    const message = interaction.options.getString('message');
    try {
        const user = await interaction.client.users.fetch(userId);
        await user.send(message);
        return interaction.reply({ content: `✅ Message sent to ${user.tag}`, ephemeral: true });
    } catch {
        return interaction.reply({ content: '❌ Failed to send DM. User may have DMs disabled.', ephemeral: true });
    }
}

module.exports = { execute };
