const { EmbedBuilder } = require('discord.js');
const Config = require('../models/config');
const router = require('./prefixCommands');

const PREFIX = '?';

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
        const cmd     = args.shift().toLowerCase();
        const guildId = message.guild.id;

        const config          = await Config.findOne({ guildId }) || {};
        const modules         = config.modules         || {};
        const bannedUsers     = config.bannedUsers     || [];
        const allowedChannels = config.allowedChannels || [];

        if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) return;

        const banEntry = bannedUsers.find(b => b.userId === message.author.id);
        if (banEntry) {
            return message.reply({ embeds: [new EmbedBuilder()
                .setTitle('🔨 You Are Banned')
                .setDescription(`You have been banned from using this bot.\n**Reason:** ${banEntry.reason || 'No reason given'}`)
                .setColor(0xff0000)] });
        }

        for (const [mod, cmds] of Object.entries(router.moduleMap)) {
            if (cmds.includes(cmd) && modules[mod] === false) {
                return message.reply({ embeds: [new EmbedBuilder()
                    .setTitle('🚫 Feature Disabled')
                    .setDescription(`The \`?${cmd}\` command is currently disabled in this server.`)
                    .setColor(0x71717a)] });
            }
        }

        const adapt = (opts = {}) => {
            let deferredMessage = null;

            return {
                user:    message.author,
                guild:   message.guild,
                member:  message.member,
                channel: message.channel,
                client,
                options: {
                    getUser:       n => opts.getUser?.(n)       ?? null,
                    getInteger:    n => opts.getInteger?.(n)    ?? null,
                    getString:     n => opts.getString?.(n)     ?? null,
                    getNumber:     n => opts.getNumber?.(n)     ?? null,
                    getSubcommand: () => opts.getSubcommand?.() ?? null,
                },
                reply:    d => message.reply(d),
                followUp: d => message.channel.send(d),
                deferReply: async () => {
                    deferredMessage = await message.reply({ content: '⏳ Working...' });
                    return deferredMessage;
                },
                editReply: async d => {
                    if (deferredMessage) return deferredMessage.edit(d);
                    deferredMessage = await message.reply(d);
                    return deferredMessage;
                },
            };
        };

        const run = (name, opts) => client.commands.get(name).execute(adapt(opts));

        return router.exec(cmd, args, message, run);
    }
};
