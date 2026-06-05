require('dotenv').config();
const { Client, Collection, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const fs       = require('fs');
const mongoose = require('mongoose');
const Stock    = require('./src/models/stock');
const Lottery  = require('./src/models/lottery');
const { drawLottery } = require('./src/utils/lottery');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

function loadCommands() {
    client.commands.clear();
    for (const file of fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'))) {
        try {
            delete require.cache[require.resolve(`./src/commands/${file}`)];
            const command = require(`./src/commands/${file}`);
            client.commands.set(command.data.name, command);
        } catch (e) {
            console.error(`Failed to load ${file}:`, e.message);
        }
    }
}

async function deployCommands() {
    const commands = [];
    for (const file of fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'))) {
        try {
            delete require.cache[require.resolve(`./src/commands/${file}`)];
            const cmd = require(`./src/commands/${file}`);
            if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
        } catch (e) {
            console.error(`Failed to read ${file}:`, e.message);
        }
    }
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log(`Deployed ${commands.length} slash commands.`);
}

function updatePresence() {
    const guildCount = client.guilds.cache.size;
    const statuses = [
        { name: `💣 Detonating in ${guildCount.toLocaleString()} servers`, type: ActivityType.Playing },
        { name: `${guildCount.toLocaleString()} economies`, type: ActivityType.Watching },
        { name: `?help | economicbomb.xyz`, type: ActivityType.Playing },
        { name: `the market crash 📉`, type: ActivityType.Watching },
    ];
    const pick = statuses[Math.floor(Math.random() * statuses.length)];
    client.user.setPresence({
        status: 'online',
        activities: [{ name: pick.name, type: pick.type }]
    });
}

loadCommands();

for (const file of fs.readdirSync('./src/events').filter(f => f.endsWith('.js'))) {
    const event = require(`./src/events/${file}`);
    client.on(event.name, (...args) => event.execute(...args, client));
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    updatePresence();
    setInterval(updatePresence, 30 * 1000);

    client.on('guildCreate', () => updatePresence());
    client.on('guildDelete', () => updatePresence());

    setInterval(async () => {
        const stocks = await Stock.find();
        for (const stock of stocks) {
            const change   = 1 + (Math.random() * 0.06 - 0.03);
            const newPrice = Math.max(0.01, parseFloat((stock.price * change).toFixed(2)));
            stock.history.push(newPrice);
            if (stock.history.length > 30) stock.history.shift();
            stock.price = newPrice;
            await stock.save();
        }
        console.log('Stock prices updated.');
    }, 30 * 60 * 1000);

    setInterval(async () => {
        const overdue = await Lottery.find({ drawAt: { $lte: new Date() } });
        for (const lottery of overdue) await drawLottery(client, lottery);
    }, 60 * 1000);
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => { console.error(err); process.exit(1); });

(async () => {
    try {
        await deployCommands();
    } catch (e) {
        console.error('Command deploy failed:', e.message);
    }

    let redeployTimer = null;
    fs.watch('./src/commands', async (_, filename) => {
        if (!filename?.endsWith('.js')) return;
        clearTimeout(redeployTimer);
        redeployTimer = setTimeout(async () => {
            console.log(`${filename} changed - redeploying commands...`);
            try {
                await deployCommands();
                loadCommands();
                console.log('Commands reloaded.');
            } catch (e) {
                console.error('Redeploy failed:', e.message);
            }
        }, 2000);
    });

    client.login(process.env.TOKEN);
})();
