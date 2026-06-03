const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const { formatNumber } = require('../../utils/format');

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

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));

        return GAMES[game].execute(interaction, user, bet);
    }
};
