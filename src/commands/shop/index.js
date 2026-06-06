const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const browse              = require('./browse');
const buy                 = require('./buy');
const sell                = require('./sell');
const { handlePage }      = browse;

const SUBS = { browse, buy, sell };

module.exports = {
    handlePage,

    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Buy or sell items and view your inventory')
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
                            { name: 'Wooden Rod ($500)',                 value: 'fishing_rod_wooden'     },
                            { name: 'Basic Rod ($3,000)',                value: 'fishing_rod_basic'      },
                            { name: 'Upgraded Rod ($15,000)',            value: 'fishing_rod_upgraded'   },
                            { name: 'Super Rod ($60,000)',               value: 'fishing_rod_super'      },
                            { name: 'Legendary Rod ($200,000)',          value: 'fishing_rod_legendary'  },
                            { name: 'Fishing Bait ($500)',               value: 'fishing_bait'           },
                            // Fishing - Buckets
                            { name: 'Wooden Bucket ($500)',              value: 'bucket_wooden'          },
                            { name: 'Iron Bucket ($2,500)',              value: 'bucket_iron'            },
                            { name: 'Gold Bucket ($12,000)',             value: 'bucket_gold'            },
                            { name: 'Diamond Bucket ($50,000)',          value: 'bucket_diamond'         },
                            { name: 'Crystal Bucket ($175,000)',         value: 'bucket_crystal'         },
                            // Mining
                            { name: 'Wooden Pickaxe ($500)',             value: 'pickaxe_wooden'      },
                            { name: 'Basic Pickaxe ($4,000)',            value: 'pickaxe_basic'       },
                            { name: 'Iron Pickaxe ($20,000)',            value: 'pickaxe_iron'        },
                            { name: 'Diamond Pickaxe ($75,000)',         value: 'pickaxe_diamond'     },
                            { name: 'Netherite Pickaxe ($250,000)',      value: 'pickaxe_netherite'   },
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
        )
        .addSubcommand(sub =>
            sub.setName('sell')
                .setDescription('Sell an item from your inventory (25% of buy price)')
                .addStringOption(o =>
                    o.setName('item').setDescription('Item to sell').setRequired(true)
                        .addChoices(
                            // General
                            { name: 'Lifesaver ($1,250)',                value: 'lifesaver'              },
                            // Fishing - Rods
                            { name: 'Wooden Rod ($125)',                 value: 'fishing_rod_wooden'     },
                            { name: 'Basic Rod ($750)',                  value: 'fishing_rod_basic'      },
                            { name: 'Upgraded Rod ($3,750)',             value: 'fishing_rod_upgraded'   },
                            { name: 'Super Rod ($15,000)',               value: 'fishing_rod_super'      },
                            { name: 'Legendary Rod ($50,000)',           value: 'fishing_rod_legendary'  },
                            { name: 'Fishing Bait ($125 each)',          value: 'fishing_bait'           },
                            // Fishing - Buckets
                            { name: 'Wooden Bucket ($125)',              value: 'bucket_wooden'          },
                            { name: 'Iron Bucket ($625)',                value: 'bucket_iron'            },
                            { name: 'Gold Bucket ($3,000)',              value: 'bucket_gold'            },
                            { name: 'Diamond Bucket ($12,500)',          value: 'bucket_diamond'         },
                            { name: 'Crystal Bucket ($43,750)',          value: 'bucket_crystal'         },
                            // Mining
                            { name: 'Wooden Pickaxe ($125)',             value: 'pickaxe_wooden'         },
                            { name: 'Basic Pickaxe ($1,000)',            value: 'pickaxe_basic'          },
                            { name: 'Iron Pickaxe ($5,000)',             value: 'pickaxe_iron'           },
                            { name: 'Diamond Pickaxe ($18,750)',         value: 'pickaxe_diamond'        },
                            { name: 'Netherite Pickaxe ($62,500)',       value: 'pickaxe_netherite'      },
                            { name: 'Mining Backpack ($875)',            value: 'mining_backpack'        },
                            { name: 'Mining Bomb ($625 each)',           value: 'mining_bomb'            },
                            // Streaming
                            { name: 'Keyboard & Mouse ($250)',           value: 'keyboard_mouse'         },
                            { name: 'Camera ($1,000)',                   value: 'camera'                 },
                            { name: 'Ring Light ($625)',                 value: 'ring_light'             },
                            { name: 'Microphone ($1,750)',               value: 'microphone'             },
                            { name: 'Dedicated Server ($4,500)',         value: 'dedicated_server'       },
                        )
                )
                .addIntegerOption(o =>
                    o.setName('quantity').setDescription('How many to sell - consumables only (default: 1)').setRequired(false).setMinValue(1).setMaxValue(99)
                )
        ),

    async execute(interaction) {
        const sub  = interaction.options.getSubcommand();
        const user = await getUser(interaction.user.id, interaction.guild.id);
        return SUBS[sub].execute(interaction, user);
    }
};
