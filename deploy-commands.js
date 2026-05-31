require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');

const commands = [];
const files = fs.readdirSync('./src/commands').filter(f => f.endsWith('.js'));

for (const file of files) {
    try {
        const command = require(`./src/commands/${file}`);

        if (!command?.data?.toJSON) {
            console.log(`❌ INVALID EXPORT: ${file}`);
            continue;
        }

        const json = command.data.toJSON();

        if (!json.name || !json.description) {
            console.log(`❌ MISSING NAME/DESCRIPTION: ${file}`);
            console.log(json);
            continue;
        }

        commands.push(json);

    } catch (err) {
        console.log(`❌ FAILED TO LOAD: ${file}`);
        console.log(err);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`🚀 Deploying ${commands.length} commands...`);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log('✅ Commands deployed successfully');
    } catch (err) {
        console.log('❌ Deploy failed:');
        console.log(err);
    }
})();
