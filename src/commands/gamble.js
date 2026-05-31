const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const cooldowns = require('../../utils/cooldowns');

const COOLDOWN = 5 * 60 * 1000;
const SYMBOLS  = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Play a gambling game')
        .addStringOption(o =>
            o.setName('game').setDescription('Game to play').setRequired(true)
                .addChoices(
                    { name: 'Slots',     value: 'slots'     },
                    { name: 'Coinflip',  value: 'coinflip'  },
                    { name: 'Dice',      value: 'dice'      }
                )
        )
        .addIntegerOption(o =>
            o.setName('bet').setDescription('Amount to bet').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('choice').setDescription('Coinflip only: heads or tails').setRequired(false)
                .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
        ),

    async execute(interaction) {
        const game   = interaction.options.getString('game');
        const bet    = interaction.options.getInteger('bet');
        const choice = interaction.options.getString('choice');
        const now    = Date.now();

        if (game === 'coinflip' && !['heads', 'tails'].includes(choice))
            return interaction.reply({ content: '❌ You must pick `heads` or `tails` for coinflip.', ephemeral: true });

        const cdMap = cooldowns[game] ?? cooldowns.slots;
        if (cdMap.has(interaction.user.id)) {
            const exp = cdMap.get(interaction.user.id) + COOLDOWN;
            if (now < exp) {
                const left = exp - now;
                const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000);
                return interaction.reply({ content: `⏳ Cooldown active. Try again in **${m > 0 ? `${m}m ${s}s` : `${s}s`}**.`, ephemeral: true });
            }
        }
        cdMap.set(interaction.user.id, now);

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));

        let title, text, winnings = 0, color;

        if (game === 'slots') {
            const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            title = 'Slots';
            if (spin[0] === spin[1] && spin[1] === spin[2]) {
                winnings = parseFloat((bet * 5).toFixed(2));
                text = `${spin.join(' | ')}\n\nJACKPOT! You won **$${fmt(winnings)}**!`;
            } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `${spin.join(' | ')}\n\nYou won **$${fmt(winnings)}**!`;
            } else {
                text = `${spin.join(' | ')}\n\nYou lost **$${fmt(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else if (game === 'coinflip') {
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            title = 'Coinflip';
            if (choice === result) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `Coin landed on **${result}**\nYou won **$${fmt(winnings)}**!`;
            } else {
                text = `Coin landed on **${result}**\nYou lost **$${fmt(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else {
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll  = Math.floor(Math.random() * 6) + 1;
            title = 'Dice Roll';
            if (userRoll > botRoll) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${fmt(winnings)}**!`;
                color = 0x00ff00;
            } else if (userRoll === botRoll) {
                winnings = bet;
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
                color = 0xffff00;
            } else {
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${fmt(bet)}**.`;
                color = 0xff0000;
            }
        }

        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(title)
            .setDescription(text)
            .setColor(color)] });
    }
};
