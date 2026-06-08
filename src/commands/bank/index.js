const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const balance  = require('./balance');
const deposit  = require('./deposit');
const withdraw = require('./withdraw');

const SUBS = { balance, deposit, withdraw };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Manage your wallet and bank')
        .addSubcommand(sub =>
            sub.setName('balance')
                .setDescription("Check your balance or someone else's")
                .addUserOption(o => o.setName('user').setDescription('User to check (default: yourself)').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('deposit')
                .setDescription('Deposit money into your bank')
                .addStringOption(o => o.setName('amount').setDescription('Amount, or: all, half, 10k, 50%').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('withdraw')
                .setDescription('Withdraw money from your bank')
                .addStringOption(o => o.setName('amount').setDescription('Amount, or: all, half, 10k, 50%').setRequired(true))
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id);
        return SUBS[sub].execute(interaction, user);
    }
};
