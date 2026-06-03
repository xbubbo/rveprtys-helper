const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const browse = require('./browse');
const buy    = require('./buy');

const SUBS = { browse, buy };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy items and view your inventory')
        .addSubcommand(sub =>
            sub.setName('browse')
                .setDescription('Browse available items and view your inventory')
        )
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Buy an item')
                .addStringOption(o =>
                    o.setName('item').setDescription('Item to buy').setRequired(true)
                        .addChoices(
                            // General
                            { name: 'Lifesaver ($5,000)',                value: 'lifesaver'              },
                            // Fishing - Rods
                            { name: 'Wooden Rod ($150)',                 value: 'fishing_rod_wooden'     },
                            { name: 'Basic Rod ($800)',                  value: 'fishing_rod_basic'      },
                            { name: 'Upgraded Rod ($4,000)',             value: 'fishing_rod_upgraded'   },
                            { name: 'Super Rod ($12,000)',               value: 'fishing_rod_super'      },
                            { name: 'Fishing Bait ($150)',               value: 'fishing_bait'           },
                            // Fishing - Buckets
                            { name: 'Wooden Bucket ($100)',              value: 'bucket_wooden'          },
                            { name: 'Iron Bucket ($600)',                value: 'bucket_iron'            },
                            { name: 'Gold Bucket ($2,500)',              value: 'bucket_gold'            },
                            { name: 'Diamond Bucket ($8,000)',           value: 'bucket_diamond'         },
                            // Mining
                            { name: 'Basic Pickaxe ($1,500)',            value: 'pickaxe_basic'       },
                            { name: 'Iron Pickaxe ($6,000)',             value: 'pickaxe_iron'        },
                            { name: 'Diamond Pickaxe ($20,000)',         value: 'pickaxe_diamond'     },
                            { name: 'Mining Backpack ($3,500)',          value: 'mining_backpack'     },
                            { name: 'Mining Bomb ($2,500)',              value: 'mining_bomb'         },
                            // Streaming
                            { name: 'Keyboard & Mouse ($1,000)',         value: 'keyboard_mouse'      },
                            { name: 'Camera ($4,000)',                   value: 'camera'              },
                            { name: 'Ring Light ($2,500)',               value: 'ring_light'          },
                            { name: 'Microphone ($7,000)',               value: 'microphone'          },
                            { name: 'Dedicated Server ($18,000)',        value: 'dedicated_server'    },
                        )
                )
                .addIntegerOption(o =>
                    o.setName('quantity').setDescription('How many to buy (default: 1)').setRequired(false).setMinValue(1).setMaxValue(99)
                )
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);
        return SUBS[sub].execute(interaction, user);
    }
};
