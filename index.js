require('dotenv').config();

const {
    Client,
    Collection,
    GatewayIntentBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const fetch = require('node-fetch');

const jackpotLeaderboard = new Map();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();


const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {


    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (command) await command.execute(interaction);
    }


    if (interaction.isButton()) {


        if (interaction.customId === 'open_order_modal') {

            const modal = new ModalBuilder()
                .setCustomId('order_modal')
                .setTitle('Order Form');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('website_ip')
                        .setLabel('Website IP')
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('website_name')
                        .setLabel('Website Name')
                        .setStyle(TextInputStyle.Short)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('filters')
                        .setLabel('List of Filter Links you want')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );

            return interaction.showModal(modal);
        }


        if (interaction.customId.startsWith('respond_')) {

            const userId = interaction.customId.split('_')[1];

            const modal = new ModalBuilder()
                .setCustomId(`response_modal_${userId}`)
                .setTitle(`Send Links`);

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('links')
                        .setLabel('Insert Links here')
                        .setStyle(TextInputStyle.Paragraph)
                )
            );

            return interaction.showModal(modal);
        }
    }


    if (interaction.isModalSubmit()) {


        if (interaction.customId === 'order_modal') {

            const ip = interaction.fields.getTextInputValue('website_ip');
            const name = interaction.fields.getTextInputValue('website_name');
            const filters = interaction.fields.getTextInputValue('filters');

            const userId = interaction.user.id;


            await interaction.user.send("Your order has been received. You will get your links soon.");

       
            const embed = {
                title: `New Order`,
                fields: [
                    { name: "User", value: `<@${userId}>` },
                    { name: "Website IP", value: ip },
                    { name: "Website Name", value: name },
                    { name: "Filters", value: filters }
                ],
                color: 0x2b2d31
            };

const components = [
    {
        type: 1,
        components: [
            {
                type: 2,
                label: "Send Links",
                style: 1,
                custom_id: `respond_${userId}`
            }
        ]
    }
];

await fetch(process.env.WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        embeds: [embed],
        components: components
    })
});

            return interaction.reply({
                content: "Order submitted! Check your DMs.",
                ephemeral: true
            });
        }


        if (interaction.customId.startsWith('response_modal_')) {

            const userId = interaction.customId.split('_')[2];
            const links = interaction.fields.getTextInputValue('links');

            try {
                const user = await client.users.fetch(userId);

                await user.send(`📦 Your Order is Ready!\n\n${links}`);

                return interaction.reply({
                    content: "Links sent to user.",
                    ephemeral: true
                });

            } catch (err) {
                return interaction.reply({
                    content: "Failed to DM user.",
                    ephemeral: true
                });
            }
        }
    }
});

client.login(process.env.TOKEN);
