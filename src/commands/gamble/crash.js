const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { pregame, makeCancelStart } = require('../../utils/pregame');
const { trackWin } = require('../../utils/gambling');

async function execute(interaction, user, bet) {
    await user.save();

    let autoLimit = null;

    const getEmbed = () => new EmbedBuilder()
        .setTitle('🚀 Crash')
        .setDescription(`Bet: **$${formatNumber(bet)}**\n` + (autoLimit ? `Auto cashout at **${autoLimit.toFixed(2)}x**` : 'No auto cashout set') + '\n\nSet a limit or start when ready.')
        .setColor(0x2b2d31);

    const getOptionRows = () => [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('crash_setlimit').setLabel('Set Limit').setStyle(ButtonStyle.Secondary),
    )];

    const { started, msg } = await pregame(interaction, user, bet, {
        title: '🚀 Crash',
        getEmbed,
        getOptionRows,
        onOption: async (i) => {
            const modal = new ModalBuilder().setCustomId('crash_limit_modal').setTitle('Set Auto Cashout');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('crash_limit_val').setLabel('Cash out at multiplier (e.g. 2.50)').setStyle(TextInputStyle.Short).setPlaceholder('1.01 - 500').setRequired(true)
            ));
            await i.showModal(modal);
            const sub = await i.awaitModalSubmit({ time: 30000 }).catch(() => null);
            if (!sub) return;
            const val = parseFloat(sub.fields.getTextInputValue('crash_limit_val'));
            if (isNaN(val) || val < 1.01 || val > 500) return sub.reply({ content: '❌ Limit must be between 1.01 and 500.', ephemeral: true });
            autoLimit = val;
            await sub.update({ embeds: [getEmbed()], components: [...getOptionRows(), makeCancelStart()] });
        },
    });

    if (!started) return;

    const r       = Math.random();
    const crashAt = parseFloat(Math.min(500, Math.max(1.01, 0.99 / (1 - r * 0.998))).toFixed(2));
    let current   = 1.00;
    let cashedOut = false;
    let crashed   = false;
    let interval;

    const crashEmbed = (mult) => new EmbedBuilder()
        .setTitle('🚀 Crash')
        .setDescription(`Multiplier: **${mult.toFixed(2)}x**\nPotential payout: **$${formatNumber(parseFloat((bet * mult).toFixed(2)))}**\n\n` + (autoLimit ? `Auto cashout at **${autoLimit.toFixed(2)}x**` : 'Cash out before it crashes!'))
        .setColor(mult < 2 ? 0x2ecc71 : mult < 10 ? 0xf1c40f : 0xe74c3c);

    const cashBtn = (mult) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('crash_cashout').setLabel(`Cash Out (${mult.toFixed(2)}x)`).setStyle(ButtonStyle.Success)
    );

    const doCashout = async (mult, buttonInteraction = null) => {
        cashedOut = true;
        clearInterval(interval);
        gameCollector.stop('done');
        let payout = parseFloat((bet * mult).toFixed(2));
        let note   = '';
        if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) { payout = parseFloat((payout * 1.05).toFixed(2)); note = '\n🛟 *+5% lifesaver boost*'; }
        user.balance = parseFloat((user.balance + payout).toFixed(2));
        trackWin(user, payout, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        const embed = new EmbedBuilder().setTitle('🚀 Crash').setDescription(`Cashed out at **${mult.toFixed(2)}x**! You won **$${formatNumber(payout)}**!${note}`).addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true }).setColor(0x00ff00);
        if (buttonInteraction) await buttonInteraction.update({ embeds: [embed], components: [] });
        else await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    };

    await msg.edit({ embeds: [crashEmbed(current)], components: [cashBtn(current)] });

    const gameCollector = msg.createMessageComponentCollector({ filter: j => j.user.id === interaction.user.id, time: 90000 });

    interval = setInterval(async () => {
        if (cashedOut || crashed) { clearInterval(interval); return; }
        current = parseFloat((current * 1.08).toFixed(2));

        if (autoLimit && current >= autoLimit && !cashedOut && !crashed) { clearInterval(interval); await doCashout(autoLimit); return; }

        if (current >= crashAt) {
            clearInterval(interval);
            if (cashedOut) return;
            crashed = true;
            gameCollector.stop('crashed');
            trackWin(user, 0, bet);
            await user.save();
            if (cashedOut) return;
            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
            await msg.edit({ embeds: [new EmbedBuilder().setTitle('🚀 Crash').setDescription(`Crashed at **${crashAt.toFixed(2)}x**!\nYou lost **$${formatNumber(bet)}**.`).setColor(0xff0000)], components: [] }).catch(() => {});
        } else {
            await msg.edit({ embeds: [crashEmbed(current)], components: [cashBtn(current)] }).catch(() => {});
        }
    }, 600);

    gameCollector.on('collect', async j => {
        if (j.customId !== 'crash_cashout' || cashedOut || crashed) return;
        await doCashout(current, j);
    });
    gameCollector.on('end', async (_, reason) => {
        if (reason !== 'done' && reason !== 'crashed' && !cashedOut && !crashed) await doCashout(current);
    });
}

module.exports = { execute };
