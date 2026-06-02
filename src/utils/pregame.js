const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function makeCancelStart() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pg_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pg_start').setLabel('Start').setStyle(ButtonStyle.Success),
    );
}

async function pregame(interaction, user, bet, { title, getEmbed, getOptionRows = () => [], onOption, timeout = 60000 }) {
    const msg = await interaction.reply({
        embeds: [getEmbed()],
        components: [...getOptionRows(), makeCancelStart()],
        fetchReply: true,
    });

    return new Promise(resolve => {
        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: timeout,
        });

        let started = false;

        collector.on('collect', async i => {
            if (i.customId === 'pg_cancel') {
                collector.stop('cancelled');
                user.balance = parseFloat((user.balance + bet).toFixed(2));
                await user.save();
                await i.update({
                    embeds: [new EmbedBuilder().setTitle(title).setDescription('Cancelled. Bet refunded.').setColor(0x71717a)],
                    components: [],
                });
                resolve({ started: false, msg });
            } else if (i.customId === 'pg_start') {
                started = true;
                collector.stop('started');
                await i.deferUpdate();
                resolve({ started: true, msg });
            } else {
                await onOption(i);
            }
        });

        collector.on('end', async (_, reason) => {
            if (!started && reason !== 'cancelled') {
                user.balance = parseFloat((user.balance + bet).toFixed(2));
                await user.save();
                await msg.edit({
                    embeds: [new EmbedBuilder().setTitle(title).setDescription('Lobby timed out. Bet refunded.').setColor(0x71717a)],
                    components: [],
                }).catch(() => {});
                resolve({ started: false, msg });
            }
        });
    });
}

module.exports = { pregame, makeCancelStart };
