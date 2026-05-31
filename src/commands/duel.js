const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                betAmount = parseFloat(raw);
                if (isNaN(betAmount) || betAmount <= 0) return interaction.reply({ content: '❌ Invalid bet amount.', ephemeral: true });
            }
            if (betAmount <= 0) return interaction.reply({ content: "❌ Neither of you have anything to bet.", ephemeral: true });
            if (challenger.balance < betAmount) return interaction.reply({ content: `❌ You don't have **$${fmt(betAmount)}** to bet.`, ephemeral: true });
            if (opponentEcon.balance < betAmount) return interaction.reply({ content: `❌ ${opponent.username} doesn't have **$${fmt(betAmount)}** to bet.`, ephemeral: true });
        }

        if (Math.random() < DEATH_CHANCE) {
            if (betAmount > 0) {
                challenger.balance = parseFloat((challenger.balance - betAmount).toFixed(2));
                opponentEcon.balance = parseFloat((opponentEcon.balance - betAmount).toFixed(2));
                await challenger.save();
                await opponentEcon.save();
            }
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('💀 Both players died...')
                    .setDescription(`${user.username} and ${opponent.username} somehow managed to kill each other.${betAmount > 0 ? `\n\nBoth lost **$${fmt(betAmount)}**.` : ''}`)
                    .setColor(0x71717a)]
            });
        }

        const participants = [user, opponent];
        const winner = participants[Math.floor(Math.random() * participants.length)];
        const loser = winner.id === user.id ? opponent : user;

        if (betAmount > 0) {
            const winnerEcon = winner.id === user.id ? challenger : opponentEcon;
            const loserEcon  = winner.id === user.id ? opponentEcon : challenger;
            winnerEcon.balance = parseFloat((winnerEcon.balance + betAmount).toFixed(2));
            loserEcon.balance  = parseFloat((loserEcon.balance  - betAmount).toFixed(2));
            await winnerEcon.save();
            await loserEcon.save();
        }

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('⚔️ Duel Result')
                .setDescription(
                    `${user.username} vs ${opponent.username}\n\n` +
                    `🏆 Winner: **${winner.username}**` +
                    (betAmount > 0 ? `\n\n**$${fmt(betAmount)}** transferred to winner` : '')
                )
                .setColor(0x2b2d31)]
        });
    }
};
