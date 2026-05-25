const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../utils/economy');

const COOLDOWN = 5 * 60 * 1000;
const cooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Bet amount')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('heads or tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )
        ),

    async execute(interaction) {
        const bet = interaction.options.getInteger('bet');
        const choice = interaction.options.getString('choice');
        const user = await getUser(interaction.user.id, interaction.guild.id);
        const now = Date.now();

        if (cooldowns.has(interaction.user.id)) {
            const expiration = cooldowns.get(interaction.user.id) + COOLDOWN;
            if (now < expiration) {
                return interaction.reply({ content: `⏳ Cooldown active.`, ephemeral: true });
            }
        }

        cooldowns.set(interaction.user.id, now);

        if (bet <= 0 || user.balance < bet) {
            return interaction.reply({ content: "❌ Invalid bet.", ephemeral: true });
        }

        user.balance -= bet;

        const result = Math.random() < 0.5 ? 'heads' : 'tails';

        let winnings = 0;
        let text = `Coin: **${result}**\n`;

        if (choice === result) {
            winnings = bet * 2;
            text += `You won $${winnings}`;
        } else {
            text += `You lost $${bet}`;
        }

        user.balance += winnings;
        await user.save();

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🪙 Coinflip')
                    .setDescription(text)
                    .setColor(winnings ? 0x00ff00 : 0xff0000)
            ]
        });
    }
};
