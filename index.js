require('dotenv').config();

const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
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

function resolveCommandPaths() {
    const paths = [];
    for (const entry of fs.readdirSync('./src/commands')) {
        const full = `./src/commands/${entry}`;
        if (entry.endsWith('.js')) {
            paths.push(full);
        } else if (fs.statSync(full).isDirectory() && fs.existsSync(`${full}/index.js`)) {
            paths.push(`${full}/index.js`);
        }
    }
    return paths;
}

function loadCommands() {
    client.commands.clear();
    for (const path of resolveCommandPaths()) {
        try {
            delete require.cache[require.resolve(path)];
            const command = require(path);
            if (command?.data?.name) client.commands.set(command.data.name, command);
        } catch (e) {
            console.error(`Failed to load ${path}:`, e.message);
        }
    }
}

async function deployCommands() {
    const commands = [];
    for (const path of resolveCommandPaths()) {
        try {
            delete require.cache[require.resolve(path)];
            const cmd = require(path);
            if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
        } catch (e) {
            console.error(`Failed to read ${path}:`, e.message);
        }
    }
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log(`Deployed ${commands.length} slash commands.`);
}

loadCommands();

for (const file of fs.readdirSync('./src/events').filter(f => f.endsWith('.js'))) {
    const event = require(`./src/events/${file}`);
    client.on(event.name, (...args) => event.execute(...args, client));
}

client.on('error', err => console.error('Client error:', err));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    setInterval(async () => {
        const stocks = await Stock.find();
        for (const stock of stocks) {
            // Base move: ±8% per tick
            let multiplier = 1 + (Math.random() * 0.16 - 0.08);

            // Market event (12% chance): bigger swing
            const roll = Math.random();
            if (roll < 0.04) {
                multiplier *= 1 + (0.15 + Math.random() * 0.25); // spike: +15-40%
            } else if (roll < 0.08) {
                multiplier *= 1 - (0.15 + Math.random() * 0.25); // crash: -15-40%
            } else if (roll < 0.12) {
                multiplier *= 1 + (Math.random() * 0.30 - 0.15); // wild swing: ±15-30%
            }

            const newPrice = Math.max(0.01, parseFloat((stock.price * multiplier).toFixed(2)));
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
