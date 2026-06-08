const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/user');

function settingsEmbed(user) {
    const dmEnabled = !user.dmOptOut;

    return new EmbedBuilder()
        .setTitle('⚙️ Your Settings')
        .setDescription('Toggle your personal preferences below. Settings apply globally across all servers.')
        .addFields(
            {
                name: 'DM Notifications',
                value: dmEnabled ? '✅ Enabled - the bot can DM you' : '❌ Disabled - the bot will not DM you',
                inline: false,
            },
        )
        .setColor(0x2b2d31)
        .setFooter({ text: 'Changes apply immediately' });
}

function settingsButtons(user) {
    const dmEnabled = !user.dmOptOut;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_toggle_dms')
            .setLabel(dmEnabled ? 'Disable DMs' : 'Enable DMs')
            .setStyle(dmEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('View and toggle your personal settings'),

    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) user = new User({ userId: interaction.user.id });

        const msg = await interaction.reply({
            embeds: [settingsEmbed(user)],
            components: [settingsButtons(user)],
            ephemeral: true,
            fetchReply: true,
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 120000,
        });

        collector.on('collect', async i => {
            if (i.customId === 'settings_toggle_dms') {
                user.dmOptOut = !user.dmOptOut;
                await user.save();
            }
            await i.update({
                embeds: [settingsEmbed(user)],
                components: [settingsButtons(user)],
            });
        });

        collector.on('end', () => {
            msg.edit({ components: [] }).catch(() => {});
        });
    }
};
