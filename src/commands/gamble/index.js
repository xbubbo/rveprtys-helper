const { SlashCommandBuilder } = require('discord.js');
const { getUser, anticheat } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');
const { trackWin } = require('../../utils/gambling');

const GAMES = {
    slots:     require('./slots'),
    coinflip:  require('./coinflip'),
    dice:      require('./dice'),
    roulette:  require('./roulette'),
    blackjack: require('./blackjack'),
    highlow:   require('./highlow'),
    crash:     require('./crash'),
    horserace: require('./horserace'),
    mines:     require('./mines'),
    baccarat:  require('./baccarat'),
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Play a gambling game')
        .addStringOption(o =>
            o.setName('game').setDescription('Game to play').setRequired(true)
                .addChoices(
                    { name: 'Slots',        value: 'slots'      },
                    { name: 'Coinflip',     value: 'coinflip'   },
                    { name: 'Dice',         value: 'dice'       },
                    { name: 'Roulette',     value: 'roulette'   },
                    { name: 'Blackjack',    value: 'blackjack'  },
                    { name: 'High / Low',   value: 'highlow'    },
                    { name: 'Crash',        value: 'crash'      },
                    { name: 'Horse Race',   value: 'horserace'  },
                    { name: 'Mines',        value: 'mines'      },
                    { name: 'Baccarat',     value: 'baccarat'   },
                )
        )
        .addIntegerOption(o =>
            o.setName('bet').setDescription('Amount to bet').setRequired(true)
        ),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const bet  = interaction.options.getInteger('bet');

        const user = await getUser(interaction.user.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));
        await user.save();

        // settle(winnings, text?) - applies boost, updates balance, tracks, saves, anticheats
        // returns { winnings, text } with boost applied if active
        const settle = async (winnings, text = '') => {
            const boosted = (user.gamblingBoostExpires ?? 0) > Date.now() && winnings > bet;
            if (boosted) {
                winnings = parseFloat((winnings * 1.05).toFixed(2));
                if (text) text += '\n🛟 *+5% lifesaver boost*';
            }
            user.balance = parseFloat((user.balance + winnings).toFixed(2));
            trackWin(user, winnings, bet);
            await user.save();
            await anticheat(interaction.client, interaction.user.id);
            return { winnings, text };
        };

        return GAMES[game].execute(interaction, user, bet, settle);
    }
};
