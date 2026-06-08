const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../../utils/auth');
const give          = require('./give');
const setbalance    = require('./setbalance');
const setbank       = require('./setbank');
const stats         = require('./stats');
const userinfo      = require('./userinfo');
const jackpot       = require('./jackpot');
const reseteconomy  = require('./reseteconomy');
const clearcooldowns = require('./clearcooldowns');
const stockfix      = require('./stockfix');
const removestock   = require('./removestock');
const setupmarket   = require('./setupmarket');
const bounty        = require('./bounty');
const dm            = require('./dm');
const panel         = require('./panel');
const season2       = require('./season2');

const SUBS = {
    give, setbalance, setbank, stats, userinfo, jackpot,
    reseteconomy, clearcooldowns, stockfix, removestock,
    setupmarket, bounty, dm, panel, season2,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('owner')
        .setDescription('Owner/admin commands')
        .addSubcommand(sub => sub.setName('give').setDescription('Give money to a user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addNumberOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
        .addSubcommand(sub => sub.setName('setbalance').setDescription("Set a user's wallet balance")
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addNumberOption(o => o.setName('amount').setDescription('New balance').setRequired(true)))
        .addSubcommand(sub => sub.setName('setbank').setDescription("Set a user's bank balance")
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addNumberOption(o => o.setName('amount').setDescription('New bank balance').setRequired(true)))
        .addSubcommand(sub => sub.setName('stats').setDescription('View global economy stats'))
        .addSubcommand(sub => sub.setName('userinfo').setDescription("View a user's economy data")
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)))
        .addSubcommand(sub => sub.setName('jackpot').setDescription('Drop money to a random user')
            .addNumberOption(o => o.setName('amount').setDescription('Amount to drop').setRequired(true)))
        .addSubcommand(sub => sub.setName('reseteconomy').setDescription('Reset all balances globally'))
        .addSubcommand(sub => sub.setName('clearcooldowns').setDescription('Clear all active cooldowns'))
        .addSubcommand(sub => sub.setName('stockfix').setDescription('Manually trigger a stock market price tick'))
        .addSubcommand(sub => sub.setName('removestock').setDescription("Remove a stock from a user's portfolio")
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(o => o.setName('ticker').setDescription('Stock ticker').setRequired(true)))
        .addSubcommand(sub => sub.setName('setupmarket').setDescription('Initialize or reset the stock market'))
        .addSubcommand(sub => sub.setName('bounty').setDescription('Set a bounty on a user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addNumberOption(o => o.setName('amount').setDescription('Bounty amount').setRequired(true)))
        .addSubcommand(sub => sub.setName('dm').setDescription('Send a DM to a user by ID')
            .addStringOption(o => o.setName('userid').setDescription('User ID').setRequired(true))
            .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true)))
        .addSubcommand(sub => sub.setName('panel').setDescription('Send the order panel'))
        .addSubcommand(sub => sub.setName('season2').setDescription('Start the Season 2 countdown timer')),

    bountyMap: bounty.bountyMap,

    async execute(interaction) {
        if (!isOwner(interaction)) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const sub = interaction.options.getSubcommand();
        return SUBS[sub].execute(interaction);
    }
};
