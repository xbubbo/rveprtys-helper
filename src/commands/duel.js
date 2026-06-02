const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../utils/economy');

const { formatNumber, parseAmount } = require('../utils/format');
const DEATH_CHANCE = 0.000001;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Challenge someone to a duel')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('Choose your opponent')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet, or "all"')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.user;
        const opponent = interaction.options.getUser('opponent');
        const betStr = interaction.options.getString('bet');

        if (opponent.bot) return interaction.reply({ content: "❌ You can't duel bots.", ephemeral: true });
        if (opponent.id === user.id) return interaction.reply({ content: "❌ You can't duel yourself.", ephemeral: true });

        const challenger = await getUser(user.id, interaction.guild.id);
        const opponentEcon = await getUser(opponent.id, interaction.guild.id);

        let betAmount = 0;
        if (betStr) {
            const raw = betStr.toLowerCase().trim();
            if (raw === 'all') {
                betAmount = Math.min(challenger.balance, opponentEcon.balance);
            } else {
                betAmount = parseAmount(betStr);
                if (isNaN(betAmount) || betAmount <= 0) return interaction.reply({ content: '❌ Invalid bet amount.', ephemeral: true });
            }
            if (betAmount <= 0) return interaction.reply({ content: "❌ Neither of you have anything to bet.", ephemeral: true });
            if (challenger.balance < betAmount) return interaction.reply({ content: `❌ You don't have **$${formatNumber(betAmount)}** to bet.`, ephemeral: true });
            if (opponentEcon.balance < betAmount) return interaction.reply({ content: `❌ ${opponent.username} doesn't have **$${formatNumber(betAmount)}** to bet.`, ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('duel_accept').setLabel('⚔️ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('duel_decline').setLabel('🏳️ Decline').setStyle(ButtonStyle.Danger)
        );

        const desc = betAmount > 0
            ? `<@${user.id}> challenges <@${opponent.id}> to a duel for **$${formatNumber(betAmount)}**!`
            : `<@${user.id}> challenges <@${opponent.id}> to a duel!`;

        const msg = await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('⚔️ Duel Challenge')
                .setDescription(`${desc}\n\n<@${opponent.id}>, do you accept?`)
                .setColor(0xFFD700)
                .setFooter({ text: 'Expires in 60 seconds' })],
            components: [row],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === opponent.id,
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'duel_decline') {
                return i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('🏳️ Duel Declined')
                        .setDescription(`<@${opponent.id}> backed down from the challenge.`)
                        .setColor(0x71717a)], components: []
                });
            }

            const freshChallenger = await getUser(user.id, interaction.guild.id);
            const freshOpponent = await getUser(opponent.id, interaction.guild.id);

            if (betAmount > 0) {
                if (freshChallenger.balance < betAmount)
                    return i.update({ embeds: [new EmbedBuilder().setTitle('❌ Duel Cancelled').setDescription(`<@${user.id}> no longer has enough to cover the bet.`).setColor(0xff3333)], components: [] });
                if (freshOpponent.balance < betAmount)
                    return i.update({ embeds: [new EmbedBuilder().setTitle('❌ Duel Cancelled').setDescription(`<@${opponent.id}> no longer has enough to cover the bet.`).setColor(0xff3333)], components: [] });
            }

            if (Math.random() < DEATH_CHANCE) {
                if (betAmount > 0) {
                    freshChallenger.balance = parseFloat((freshChallenger.balance - betAmount).toFixed(2));
                    freshOpponent.balance = parseFloat((freshOpponent.balance - betAmount).toFixed(2));
                    await freshChallenger.save();
                    await freshOpponent.save();
                }
                return i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('💀 Both Players Died')
                        .setDescription(`${user.username} and ${opponent.username} somehow managed to kill each other.${betAmount > 0 ? `\n\nBoth lost **$${formatNumber(betAmount)}**.` : ''}`)
                        .setColor(0x71717a)], components: []
                });
            }

            const winner = Math.random() < 0.5 ? user : opponent;
            const winnerEcon = winner.id === user.id ? freshChallenger : freshOpponent;
            const loserEcon = winner.id === user.id ? freshOpponent : freshChallenger;

            if (betAmount > 0) {
                winnerEcon.balance = parseFloat((winnerEcon.balance + betAmount).toFixed(2));
                loserEcon.balance = parseFloat((loserEcon.balance - betAmount).toFixed(2));
                await winnerEcon.save();
                await loserEcon.save();
            }

            return i.update({
                embeds: [new EmbedBuilder()
                    .setTitle('⚔️ Duel Result')
                    .setDescription(
                        `${user.username} vs ${opponent.username}\n\n` +
                        `🏆 Winner: **${winner.username}**` +
                        (betAmount > 0 ? `\n💰 **$${formatNumber(betAmount)}** transferred to the winner` : '')
                    )
                    .setColor(0x00cc44)], components: []
            });
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                msg.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle('⏰ Duel Expired')
                        .setDescription(`<@${opponent.id}> didn't respond in time.`)
                        .setColor(0x71717a)], components: []
                }).catch(() => { });
            }
        });
    }
};
