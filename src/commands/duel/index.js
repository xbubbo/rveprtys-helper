const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber, parseAmount } = require('../../utils/format');

const DEATH_CHANCE = 0.000001;

const WIN_MSGS = [
    'landed the killing blow',
    'outmaneuvered their opponent',
    'emerged victorious after a fierce exchange',
    'showed absolutely no mercy',
    'proved their dominance without breaking a sweat',
    'caught their opponent completely off guard',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Challenge someone to a duel')
        .addUserOption(o =>
            o.setName('opponent').setDescription('Who to challenge').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('bet').setDescription('Amount to bet, or "all"').setRequired(false)
        ),

    async execute(interaction) {
        const challenger   = interaction.user;
        const opponent     = interaction.options.getUser('opponent');
        const betStr       = interaction.options.getString('bet');

        if (opponent.bot)                return interaction.reply({ content: "❌ You can't duel bots.", ephemeral: true });
        if (opponent.id === challenger.id) return interaction.reply({ content: "❌ You can't duel yourself.", ephemeral: true });

        const challengerEcon = await getUser(challenger.id, interaction.guild.id);
        const opponentEcon   = await getUser(opponent.id,   interaction.guild.id);

        let betAmount = 0;
        if (betStr) {
            const raw = betStr.toLowerCase().trim();
            betAmount = raw === 'all'
                ? Math.min(challengerEcon.balance, opponentEcon.balance)
                : parseAmount(betStr);

            if (isNaN(betAmount) || betAmount <= 0)
                return interaction.reply({ content: '❌ Invalid bet amount.', ephemeral: true });
            if (betAmount <= 0)
                return interaction.reply({ content: "❌ Neither of you have anything to bet.", ephemeral: true });
            if (challengerEcon.balance < betAmount)
                return interaction.reply({ content: `❌ You don't have **$${formatNumber(betAmount)}**.`, ephemeral: true });
            if (opponentEcon.balance < betAmount)
                return interaction.reply({ content: `❌ ${opponent.username} doesn't have **$${formatNumber(betAmount)}**.`, ephemeral: true });
        }

        const hasBet = betAmount > 0;
        const challengeDesc = hasBet
            ? `<@${challenger.id}> challenges <@${opponent.id}> to a duel for **$${formatNumber(betAmount)}**!`
            : `<@${challenger.id}> challenges <@${opponent.id}> to a duel!`;

        const msg = await interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('⚔️ Duel Challenge')
                .setDescription(`${challengeDesc}\n\n<@${opponent.id}>, do you accept?`)
                .setColor(0xFFD700)
                .setFooter({ text: 'Expires in 60 seconds' })],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('duel_accept').setLabel('⚔️ Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('duel_decline').setLabel('🏳️ Decline').setStyle(ButtonStyle.Danger),
            )],
            fetchReply: true,
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === opponent.id,
            time: 60000,
            max: 1,
        });

        collector.on('collect', async i => {
            if (i.customId === 'duel_decline') {
                return i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('Duel Declined')
                        .setDescription(`<@${opponent.id}> backed down from the challenge.`)
                        .setColor(0x71717a)],
                    components: [],
                });
            }

            const freshChallenger = await getUser(challenger.id, interaction.guild.id);
            const freshOpponent   = await getUser(opponent.id,   interaction.guild.id);

            if (hasBet) {
                if (freshChallenger.balance < betAmount)
                    return i.update({ embeds: [new EmbedBuilder().setTitle('Duel Cancelled').setDescription(`<@${challenger.id}> no longer has enough to cover the bet.`).setColor(0xff3333)], components: [] });
                if (freshOpponent.balance < betAmount)
                    return i.update({ embeds: [new EmbedBuilder().setTitle('Duel Cancelled').setDescription(`<@${opponent.id}> no longer has enough to cover the bet.`).setColor(0xff3333)], components: [] });
            }

            if (Math.random() < DEATH_CHANCE) {
                if (hasBet) {
                    freshChallenger.balance = parseFloat((freshChallenger.balance - betAmount).toFixed(2));
                    freshOpponent.balance   = parseFloat((freshOpponent.balance   - betAmount).toFixed(2));
                    await freshChallenger.save();
                    await freshOpponent.save();
                }
                return i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('💀 Both Players Died')
                        .setDescription(`${challenger.username} and ${opponent.username} somehow managed to kill each other.${hasBet ? `\n\nBoth lost **$${formatNumber(betAmount)}**.` : ''}`)
                        .setColor(0x71717a)],
                    components: [],
                });
            }

            const winnerUser  = Math.random() < 0.5 ? challenger : opponent;
            const loserUser   = winnerUser.id === challenger.id ? opponent : challenger;
            const winnerEcon  = winnerUser.id === challenger.id ? freshChallenger : freshOpponent;
            const loserEcon   = winnerUser.id === challenger.id ? freshOpponent : freshChallenger;

            if (hasBet) {
                winnerEcon.balance = parseFloat((winnerEcon.balance + betAmount).toFixed(2));
                loserEcon.balance  = parseFloat((loserEcon.balance  - betAmount).toFixed(2));
                await winnerEcon.save();
                await loserEcon.save();
            }

            const embed = new EmbedBuilder()
                .setTitle('⚔️ Duel Result')
                .setDescription(`**${winnerUser.username}** ${pick(WIN_MSGS)}.\n\n🏆 **${winnerUser.username}** defeated **${loserUser.username}**`)
                .setColor(0x00cc44);

            if (hasBet) {
                embed.addFields(
                    { name: `${winnerUser.username}`, value: `$${formatNumber(winnerEcon.balance)} (+$${formatNumber(betAmount)})`, inline: true },
                    { name: `${loserUser.username}`,  value: `$${formatNumber(loserEcon.balance)} (-$${formatNumber(betAmount)})`,  inline: true },
                );
            }

            return i.update({ embeds: [embed], components: [] });
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                msg.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle('⏰ Duel Expired')
                        .setDescription(`<@${opponent.id}> didn't respond in time.`)
                        .setColor(0x71717a)],
                    components: [],
                }).catch(() => {});
            }
        });
    }
};
