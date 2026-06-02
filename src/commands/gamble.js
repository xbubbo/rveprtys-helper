const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');
const { formatNumber } = require('../utils/format');
const { pregame, makeCancelStart } = require('../utils/pregame');
const {
    SYMBOLS, RED_NUMS, HORSES,
    shuffledDeck, cardPoints, handTotal, showHand, cardRank,
    baccaratVal, baccaratTotal, trackWin, applyBoost, refundTimeout,
} = require('../utils/gambling');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Play a gambling game')
        .addStringOption(o =>
            o.setName('game').setDescription('Game to play').setRequired(true)
                .addChoices(
                    { name: 'Slots', value: 'slots' },
                    { name: 'Coinflip', value: 'coinflip' },
                    { name: 'Dice', value: 'dice' },
                    { name: 'Roulette', value: 'roulette' },
                    { name: 'Blackjack', value: 'blackjack' },
                    { name: 'High / Low', value: 'highlow' },
                    { name: 'Crash', value: 'crash' },
                    { name: 'Horse Race', value: 'horserace' },
                    { name: 'Mines',        value: 'mines'   },
                    { name: 'Baccarat', value: 'baccarat' }
                )
        )
        .addIntegerOption(o =>
            o.setName('bet').setDescription('Amount to bet').setRequired(true)
        ),

    async execute(interaction) {
        const game = interaction.options.getString('game');
        const bet = interaction.options.getInteger('bet');

        const user = await getUser(interaction.user.id, interaction.guild.id);
        if (!bet || bet <= 0 || user.balance < bet)
            return interaction.reply({ content: '❌ Invalid bet or insufficient balance.', ephemeral: true });

        user.balance = parseFloat((user.balance - bet).toFixed(2));

        if (game === 'blackjack') {
            const deck = shuffledDeck();
            let playerHand = [deck.pop(), deck.pop()];
            const dealerHand = [deck.pop(), deck.pop()];

            if (handTotal(playerHand) === 21 || handTotal(dealerHand) === 21) {
                const pBJ = handTotal(playerHand) === 21, dBJ = handTotal(dealerHand) === 21;
                let winnings = 0, result;
                if (pBJ && dBJ) { winnings = bet; result = `Both Blackjack - Push, bet refunded.`; }
                else if (pBJ) { winnings = parseFloat((bet * 2.5).toFixed(2)); result = `Blackjack! You won **$${formatNumber(winnings)}**!`; }
                else { result = `Dealer Blackjack. You lost **$${formatNumber(bet)}**.`; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setTitle('🃏 Blackjack')
                        .setDescription(`Your hand: ${showHand(playerHand)} = **${handTotal(playerHand)}**\nDealer: ${showHand(dealerHand)} = **${handTotal(dealerHand)}**\n\n${result}`)
                        .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)]
                });
            }

            await user.save();

            const bjEmbed = (pHand, extra = '') => new EmbedBuilder()
                .setTitle('🃏 Blackjack')
                .setDescription(`Your hand: ${showHand(pHand)} = **${handTotal(pHand)}**\nDealer shows: \`${dealerHand[0].v}${dealerHand[0].s}\` + ?\n\n${extra || 'Hit or Stand?'}`)
                .setColor(0x2b2d31);

            const bjButtons = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({ embeds: [bjEmbed(playerHand)], components: [bjButtons()], fetchReply: true });

            const finish = async (i, pHand) => {
                let dHand = [...dealerHand];
                while (handTotal(dHand) < 17) dHand.push(deck.pop());
                const pVal = handTotal(pHand), dVal = handTotal(dHand);
                let winnings = 0, result;
                if (pVal > 21) { result = `Bust! You lost **$${formatNumber(bet)}**.`; }
                else if (dVal > 21) { winnings = parseFloat((bet * 2).toFixed(2)); result = `Dealer busts! You won **$${formatNumber(winnings)}**!`; }
                else if (pVal > dVal) { winnings = parseFloat((bet * 2).toFixed(2)); result = `You win! You won **$${formatNumber(winnings)}**!`; }
                else if (pVal < dVal) { result = `Dealer wins. You lost **$${formatNumber(bet)}**.`; }
                else { winnings = bet; result = `Push - bet refunded.`; }
                if ((user.gamblingBoostExpires ?? 0) > Date.now() && winnings > bet) { winnings = parseFloat((winnings * 1.05).toFixed(2)); result += ' 🛟 *+5%*'; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                const embed = new EmbedBuilder().setTitle('🃏 Blackjack')
                    .setDescription(`Your hand: ${showHand(pHand)} = **${pVal}**\nDealer: ${showHand(dHand)} = **${dVal}**\n\n${result}`)
                    .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000);
                if (i) await i.update({ embeds: [embed], components: [] });
                else await msg.edit({ embeds: [embed], components: [] }).catch(() => { });
            };

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            collector.on('collect', async i => {
                if (i.customId === 'bj_hit') {
                    playerHand.push(deck.pop());
                    if (handTotal(playerHand) >= 21) { collector.stop('done'); await finish(i, playerHand); }
                    else await i.update({ embeds: [bjEmbed(playerHand)], components: [bjButtons()] });
                } else {
                    collector.stop('done');
                    await finish(i, playerHand);
                }
            });
            collector.on('end', async (_, reason) => { if (reason !== 'done') await finish(null, playerHand); });
            return;
        }

        if (game === 'coinflip') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🪙 Coinflip')
                    .setDescription(`Bet: **$${formatNumber(bet)}**\n\nPick a side!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('cf_heads').setLabel('Heads').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('cf_tails').setLabel('Tails').setStyle(ButtonStyle.Secondary),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const pick = i.customId === 'cf_heads' ? 'heads' : 'tails';
                const result = Math.random() < 0.5 ? 'heads' : 'tails';
                let winnings = 0, text;
                if (pick === result) {
                    winnings = parseFloat((bet * 2).toFixed(2));
                    text = `Coin landed on **${result}**\nYou won **$${formatNumber(winnings)}**!`;
                } else {
                    text = `Coin landed on **${result}**\nYou lost **$${formatNumber(bet)}**.`;
                }
                ({ winnings, text } = applyBoost(user, winnings, text));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription(text)
                        .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                        .setColor(winnings ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🪙 Coinflip').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => { });
                }
            });
            return;
        }

        if (game === 'roulette') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎡 Roulette')
                    .setDescription(`Bet: **$${formatNumber(bet)}**\n\n🔴 Red (2x) | ⚫ Black (2x) | 🟢 Green / 0 (35x)\n\nPlace your bet!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('rl_red').setLabel('Red').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('rl_black').setLabel('Black').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('rl_green').setLabel('Green (0)').setStyle(ButtonStyle.Success),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const pick = i.customId === 'rl_red' ? 'red' : i.customId === 'rl_black' ? 'black' : 'green';
                const spin = Math.floor(Math.random() * 37);
                const spinColor = spin === 0 ? 'green' : RED_NUMS.has(spin) ? 'red' : 'black';
                const emoji = { red: '🔴', black: '⚫', green: '🟢' }[spinColor];
                let winnings = 0, text;
                if (pick === spinColor) {
                    winnings = pick === 'green' ? parseFloat((bet * 35).toFixed(2)) : parseFloat((bet * 2).toFixed(2));
                    text = `${emoji} **${spin}**\nYou bet **${pick}** - You won **$${formatNumber(winnings)}**!`;
                } else {
                    text = `${emoji} **${spin}**\nYou bet **${pick}** - You lost **$${formatNumber(bet)}**.`;
                }
                ({ winnings, text } = applyBoost(user, winnings, text));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription(text)
                        .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                        .setColor(winnings ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🎡 Roulette').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => { });
                }
            });
            return;
        }

        if (game === 'baccarat') {
            await user.save();

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎰 Baccarat')
                    .setDescription(`Bet: **$${formatNumber(bet)}**\n\nPlayer (2x) | Banker (1.95x) | Tie (9x)\n\nPlace your bet!`)
                    .setColor(0x2b2d31)],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bac_player').setLabel('Player (2x)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('bac_banker').setLabel('Banker (1.95x)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('bac_tie').setLabel('Tie (9x)').setStyle(ButtonStyle.Success),
                )],
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const choice = i.customId.replace('bac_', '');
                const deck = shuffledDeck();
                let pHand = [deck.pop(), deck.pop()];
                let bHand = [deck.pop(), deck.pop()];
                let pTotal = baccaratTotal(pHand);
                let bTotal = baccaratTotal(bHand);
                if (pTotal < 8 && bTotal < 8) {
                    if (pTotal <= 5) pHand.push(deck.pop());
                    if (bTotal <= 5) bHand.push(deck.pop());
                    pTotal = baccaratTotal(pHand);
                    bTotal = baccaratTotal(bHand);
                }
                const winner = pTotal > bTotal ? 'player' : bTotal > pTotal ? 'banker' : 'tie';
                let winnings = 0, bacLine;
                if (winner === 'tie' && choice !== 'tie') {
                    winnings = bet;
                    bacLine = `It's a **tie**! Your bet is pushed back.`;
                } else if (choice === winner) {
                    if (choice === 'player') winnings = parseFloat((bet * 2).toFixed(2));
                    else if (choice === 'banker') winnings = parseFloat((bet * 1.95).toFixed(2));
                    else winnings = parseFloat((bet * 9).toFixed(2));
                    bacLine = `You bet on **${choice}** and won **$${formatNumber(winnings)}**!`;
                } else {
                    bacLine = `**${winner.charAt(0).toUpperCase() + winner.slice(1)}** wins. You lost **$${formatNumber(bet)}**.`;
                }
                ({ winnings, text: bacLine } = applyBoost(user, winnings, bacLine));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎰 Baccarat')
                        .setDescription(`**Player:** ${showHand(pHand)} = **${pTotal}**\n**Banker:** ${showHand(bHand)} = **${bTotal}**\n\n${bacLine}`)
                        .addFields(
                            { name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true },
                            { name: '🎯 You Bet On', value: choice, inline: true },
                        )
                        .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🎰 Baccarat').setDescription('You took too long. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => { });
                }
            });
            return;
        }

        if (game === 'crash') {
            await user.save();

            let autoLimit = null;

            const getEmbed = () => new EmbedBuilder()
                .setTitle('🚀 Crash')
                .setDescription(
                    `Bet: **$${formatNumber(bet)}**\n` +
                    (autoLimit ? `Auto cashout at **${autoLimit.toFixed(2)}x**` : 'No auto cashout set') +
                    '\n\nSet a limit or start when ready.'
                )
                .setColor(0x2b2d31);

            const getOptionRows = () => [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('crash_setlimit').setLabel('Set Limit').setStyle(ButtonStyle.Secondary),
            )];

            const { started, msg } = await pregame(interaction, user, bet, {
                title: '🚀 Crash',
                getEmbed,
                getOptionRows,
                onOption: async (i) => {
                    const modal = new ModalBuilder().setCustomId('crash_limit_modal').setTitle('Set Auto Cashout');
                    modal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('crash_limit_val')
                            .setLabel('Cash out at multiplier (e.g. 2.50)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('1.01 - 500')
                            .setRequired(true)
                    ));
                    await i.showModal(modal);
                    const sub = await i.awaitModalSubmit({ time: 30000 }).catch(() => null);
                    if (!sub) return;
                    const val = parseFloat(sub.fields.getTextInputValue('crash_limit_val'));
                    if (isNaN(val) || val < 1.01 || val > 500)
                        return sub.reply({ content: '❌ Limit must be between 1.01 and 500.', ephemeral: true });
                    autoLimit = val;
                    await sub.update({ embeds: [getEmbed()], components: [...getOptionRows(), makeCancelStart()] });
                },
            });

            if (!started) return;

            {

                    const r       = Math.random();
                    const crashAt = parseFloat(Math.min(500, Math.max(1.01, 0.99 / (1 - r * 0.998))).toFixed(2));
                    let current   = 1.00;
                    let cashedOut = false;
                    let crashed   = false;
                    let interval;

                    const crashEmbed = (mult) => new EmbedBuilder()
                        .setTitle('🚀 Crash')
                        .setDescription(
                            `Multiplier: **${mult.toFixed(2)}x**\n` +
                            `Potential payout: **$${formatNumber(parseFloat((bet * mult).toFixed(2)))}**\n\n` +
                            (autoLimit ? `Auto cashout at **${autoLimit.toFixed(2)}x**` : 'Cash out before it crashes!')
                        )
                        .setColor(mult < 2 ? 0x2ecc71 : mult < 10 ? 0xf1c40f : 0xe74c3c);

                    const cashBtn = (mult) => new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('crash_cashout').setLabel(`Cash Out (${mult.toFixed(2)}x)`).setStyle(ButtonStyle.Success)
                    );

                    const doCashout = async (mult, buttonInteraction = null) => {
                        cashedOut = true;
                        clearInterval(interval);
                        gameCollector.stop('done');
                        let payout = parseFloat((bet * mult).toFixed(2));
                        let note   = '';
                        if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) { payout = parseFloat((payout * 1.05).toFixed(2)); note = '\n🛟 *+5% lifesaver boost*'; }
                        user.balance = parseFloat((user.balance + payout).toFixed(2));
                        trackWin(user, payout, bet);
                        await user.save();
                        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                        const embed = new EmbedBuilder().setTitle('🚀 Crash')
                            .setDescription(`Cashed out at **${mult.toFixed(2)}x**! You won **$${formatNumber(payout)}**!${note}`)
                            .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                            .setColor(0x00ff00);
                        if (buttonInteraction) await buttonInteraction.update({ embeds: [embed], components: [] });
                        else await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
                    };

                    await msg.edit({ embeds: [crashEmbed(current)], components: [cashBtn(current)] });

                    const gameCollector = msg.createMessageComponentCollector({
                        filter: j => j.user.id === interaction.user.id,
                        time: 90000,
                    });

                    interval = setInterval(async () => {
                        if (cashedOut || crashed) { clearInterval(interval); return; }
                        current = parseFloat((current * 1.08).toFixed(2));

                        if (autoLimit && current >= autoLimit && !cashedOut && !crashed) {
                            clearInterval(interval);
                            await doCashout(autoLimit);
                            return;
                        }

                        if (current >= crashAt) {
                            clearInterval(interval);
                            if (cashedOut) return;
                            crashed = true;
                            gameCollector.stop('crashed');
                            trackWin(user, 0, bet);
                            await user.save();
                            if (cashedOut) return;
                            await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                            await msg.edit({
                                embeds: [new EmbedBuilder().setTitle('🚀 Crash').setDescription(`Crashed at **${crashAt.toFixed(2)}x**!\nYou lost **$${formatNumber(bet)}**.`).setColor(0xff0000)],
                                components: [],
                            }).catch(() => {});
                        } else {
                            await msg.edit({ embeds: [crashEmbed(current)], components: [cashBtn(current)] }).catch(() => {});
                        }
                    }, 600);

                    gameCollector.on('collect', async j => {
                        if (j.customId !== 'crash_cashout' || cashedOut || crashed) return;
                        await doCashout(current, j);
                    });

                    gameCollector.on('end', async (_, reason) => {
                        if (reason !== 'done' && reason !== 'crashed' && !cashedOut && !crashed)
                            await doCashout(current);
                    });
            }

            return;
        }

        if (game === 'horserace') {
            await user.save();

            const horseList = HORSES.map(h => `${h.emoji} **${h.name}** - ${h.odds}x`).join('\n');
            const rows = [
                new ActionRowBuilder().addComponents(
                    HORSES.slice(0, 3).map((h, i) =>
                        new ButtonBuilder().setCustomId(`horse_${i}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary)
                    )
                ),
                new ActionRowBuilder().addComponents(
                    HORSES.slice(3).map((h, i) =>
                        new ButtonBuilder().setCustomId(`horse_${i + 3}`).setLabel(`${h.name} (${h.odds}x)`).setStyle(ButtonStyle.Primary)
                    )
                ),
            ];

            const msg = await interaction.reply({
                embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription(`**Pick your horse:**\n\n${horseList}\n\nBet: **$${formatNumber(bet)}**`).setColor(0x2b2d31)],
                components: rows,
                fetchReply: true,
            });

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });

            collector.on('collect', async i => {
                const idx = parseInt(i.customId.split('_')[1]);
                const pick = HORSES[idx];

                const weights = HORSES.map(h => 1 / h.odds);
                const total = weights.reduce((a, b) => a + b, 0);
                let r = Math.random() * total;
                let winnerIdx = HORSES.length - 1;
                for (let j = 0; j < weights.length; j++) { r -= weights[j]; if (r <= 0) { winnerIdx = j; break; } }
                const winner = HORSES[winnerIdx];

                const raceLines = HORSES.map((h, j) => `${j === winnerIdx ? '🥇' : '   '} ${h.emoji} ${h.name}`).join('\n');

                let winnings = 0, resultText;
                if (winnerIdx === idx) {
                    winnings = parseFloat((bet * pick.odds).toFixed(2));
                    resultText = `Your horse **${pick.name}** won! You won **$${formatNumber(winnings)}**!`;
                } else {
                    resultText = `**${winner.name}** won the race. Your horse **${pick.name}** lost **$${formatNumber(bet)}**.`;
                }
                ({ winnings, text: resultText } = applyBoost(user, winnings, resultText));
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                await i.update({
                    embeds: [new EmbedBuilder().setTitle('🏇 Horse Race Results')
                        .setDescription(`${raceLines}\n\n${resultText}`)
                        .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                        .setColor(winnings > 0 ? 0x00ff00 : 0xff0000)],
                    components: [],
                });
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await refundTimeout(user, bet);
                    await msg.edit({
                        embeds: [new EmbedBuilder().setTitle('🏇 Horse Race').setDescription('You took too long to pick a horse. Bet refunded.').setColor(0xffff00)],
                        components: [],
                    }).catch(() => { });
                }
            });
            return;
        }

        if (game === 'highlow') {
            await user.save();
            const deck = shuffledDeck();
            let currentCard = deck.pop();
            let multiplier = 1;

            const hlEmbed = (card, mult, extra = '') => new EmbedBuilder()
                .setTitle('🃏 High / Low')
                .setDescription(
                    `Current card: \`${card.v}${card.s}\`\n` +
                    `Multiplier: **${mult.toFixed(2)}x** - Potential payout: **$${formatNumber(parseFloat((bet * mult).toFixed(2)))}**\n\n` +
                    (extra || 'Will the next card be higher or lower?')
                )
                .setColor(0x2b2d31);

            const hlButtons = (mult) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hl_high').setLabel('Higher ▲').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('hl_low').setLabel('Lower ▼').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('hl_cash').setLabel(`Cash Out ($${formatNumber(parseFloat((bet * mult).toFixed(2)))})`).setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({ embeds: [hlEmbed(currentCard, multiplier)], components: [hlButtons(multiplier)], fetchReply: true });

            const cashOut = async (i, mult, timedOut = false) => {
                let payout = parseFloat((bet * mult).toFixed(2));
                if ((user.gamblingBoostExpires ?? 0) > Date.now() && payout > bet) payout = parseFloat((payout * 1.05).toFixed(2));
                user.balance = parseFloat((user.balance + payout).toFixed(2));
                trackWin(user, payout, bet);
                await user.save();
                const embed = new EmbedBuilder().setTitle('🃏 High / Low')
                    .setDescription(timedOut
                        ? `Timed out - auto cashed out at **${mult.toFixed(2)}x**!\nYou received **$${formatNumber(payout)}**.`
                        : `Cashed out at **${mult.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`)
                    .setColor(payout > bet ? 0x00ff00 : 0xffff00);
                if (i) await i.update({ embeds: [embed], components: [] });
                else await msg.edit({ embeds: [embed], components: [] }).catch(() => { });
            };

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });
            collector.on('collect', async i => {
                if (i.customId === 'hl_cash') { collector.stop('done'); await cashOut(i, multiplier); return; }
                const nextCard = deck.pop();
                const currRank = cardRank(currentCard);
                const nextRank = cardRank(nextCard);
                if (nextRank === currRank) {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Equal! You lost **$${formatNumber(bet)}**.`).setColor(0xff0000)], components: [] });
                    return;
                }
                const correct = i.customId === 'hl_high' ? nextRank > currRank : nextRank < currRank;
                if (correct) {
                    multiplier = parseFloat((multiplier * 1.8).toFixed(2));
                    currentCard = nextCard;
                    await i.update({ embeds: [hlEmbed(currentCard, multiplier, `Correct! Keep going or cash out.`)], components: [hlButtons(multiplier)] });
                } else {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('🃏 High / Low').setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Wrong! You lost **$${formatNumber(bet)}**.`).setColor(0xff0000)], components: [] });
                }
            });
            collector.on('end', async (_, reason) => { if (reason !== 'done') await cashOut(null, multiplier, true); });
            return;
        }

        if (game === 'mines') {
            await user.save();

            let gridSize = 3;
            let mineCount = 3;
            const maxMines = () => gridSize * gridSize - 1;

            const getEmbed = () => new EmbedBuilder()
                .setTitle('💣 Mines')
                .setDescription(
                    `Bet: **$${formatNumber(bet)}**\n` +
                    `Grid: **${gridSize}x${gridSize}** | Mines: **${mineCount}**\n\n` +
                    `Reveal safe tiles to grow your multiplier.\nHit a mine and you lose everything.`
                )
                .setColor(0x2b2d31);

            const getOptionRows = () => [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('mines_grid_3').setLabel('3x3').setStyle(gridSize === 3 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('mines_grid_4').setLabel('4x4').setStyle(gridSize === 4 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('mines_grid_5').setLabel('5x5').setStyle(gridSize === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('mines_minus').setLabel('-').setStyle(ButtonStyle.Secondary).setDisabled(mineCount <= 1),
                    new ButtonBuilder().setCustomId('mines_count').setLabel(`${mineCount} mine${mineCount !== 1 ? 's' : ''}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('mines_plus').setLabel('+').setStyle(ButtonStyle.Secondary).setDisabled(mineCount >= maxMines()),
                ),
            ];

            const { started, msg } = await pregame(interaction, user, bet, {
                title: '💣 Mines',
                getEmbed,
                getOptionRows,
                onOption: async (i) => {
                    if (i.customId === 'mines_grid_3') { gridSize = 3; mineCount = Math.min(mineCount, maxMines()); }
                    if (i.customId === 'mines_grid_4') { gridSize = 4; mineCount = Math.min(mineCount, maxMines()); }
                    if (i.customId === 'mines_grid_5') gridSize = 5;
                    if (i.customId === 'mines_minus' && mineCount > 1) mineCount--;
                    if (i.customId === 'mines_plus' && mineCount < maxMines()) mineCount++;
                    await i.update({ embeds: [getEmbed()], components: [...getOptionRows(), makeCancelStart()] });
                },
            });

            if (!started) return;

            const is5x5   = gridSize === 5;
            const total   = gridSize * gridSize;
            const mineSet = new Set();
            while (mineSet.size < mineCount) mineSet.add(Math.floor(Math.random() * total));

            const revealed = Array(total).fill(false);
            let safeReveals = 0;
            let multiplier  = 1.0;
            let gameOver    = false;

            const nextMultiplier = () =>
                parseFloat((multiplier * 0.97 * (total - safeReveals) / (total - mineCount - safeReveals)).toFixed(4));

            const cashoutRow = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('mine_cashout')
                    .setLabel(`Cash Out (${multiplier.toFixed(2)}x - $${formatNumber(parseFloat((bet * multiplier).toFixed(2)))})`)
                    .setStyle(ButtonStyle.Primary)
            );

            const buildGrid = (showMines = false) => {
                const rows = [];
                for (let r = 0; r < gridSize; r++) {
                    const row = new ActionRowBuilder();
                    for (let c = 0; c < gridSize; c++) {
                        const idx = r * gridSize + c;
                        const btn = new ButtonBuilder().setCustomId(`mine_${idx}`).setStyle(ButtonStyle.Secondary);
                        if (revealed[idx]) {
                            mineSet.has(idx)
                                ? btn.setEmoji('💣').setStyle(ButtonStyle.Danger).setDisabled(true)
                                : btn.setEmoji('💎').setStyle(ButtonStyle.Success).setDisabled(true);
                        } else if (showMines && mineSet.has(idx)) {
                            btn.setEmoji('💣').setStyle(ButtonStyle.Danger).setDisabled(true);
                        } else {
                            btn.setEmoji('🟦').setDisabled(showMines || gameOver);
                        }
                        row.addComponents(btn);
                    }
                    rows.push(row);
                }
                if (!is5x5 && !showMines && !gameOver) rows.push(cashoutRow());
                return rows;
            };

            const minesEmbed = (state = 'playing') => {
                const payout = parseFloat((bet * multiplier).toFixed(2));
                if (state === 'playing') return new EmbedBuilder().setTitle('💣 Mines')
                    .setDescription(`**${multiplier.toFixed(2)}x** | **${safeReveals}** safe | **${mineCount}** mines hidden`)
                    .setColor(0x2ecc71);
                if (state === 'cashout') return new EmbedBuilder().setTitle('💣 Mines')
                    .setDescription(`Cashed out at **${multiplier.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`)
                    .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                    .setColor(0x00ff00);
                if (state === 'boom') return new EmbedBuilder().setTitle('💣 Mines')
                    .setDescription(`💥 You hit a mine! You lost **$${formatNumber(bet)}**.`)
                    .setColor(0xff0000);
                if (state === 'cleared') return new EmbedBuilder().setTitle('💣 Mines')
                    .setDescription(`🎉 Board cleared at **${multiplier.toFixed(2)}x**! You won **$${formatNumber(payout)}**!`)
                    .addFields({ name: '💵 New Balance', value: `$${formatNumber(user.balance)}`, inline: true })
                    .setColor(0xFFD700);
            };

            await msg.edit({ embeds: [minesEmbed()], components: buildGrid() });

            // 5x5 uses all 5 button rows for the grid - cash out lives in a separate follow-up
            let cashoutMsg = null;
            if (is5x5) {
                cashoutMsg = await interaction.followUp({ components: [cashoutRow()], fetchReply: true });
            }

            const clearCashoutMsg = () => cashoutMsg?.edit({ components: [] }).catch(() => {});

            const gameCollector = msg.createMessageComponentCollector({
                filter: j => j.user.id === interaction.user.id,
                time: 300000,
            });

            const doCashout = async (j = null, fromCashoutMsg = false) => {
                gameOver = true;
                gameCollector.stop('cashout');
                let payout = parseFloat((bet * multiplier).toFixed(2));
                let note   = '';
                ({ winnings: payout, text: note } = applyBoost(user, payout, note));
                user.balance = parseFloat((user.balance + payout).toFixed(2));
                trackWin(user, payout, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                const embed      = minesEmbed('cashout');
                const components = buildGrid(true);
                if (fromCashoutMsg && j) {
                    await j.update({ components: [] });
                    await msg.edit({ embeds: [embed], components }).catch(() => {});
                } else if (j) {
                    await j.update({ embeds: [embed], components });
                    await clearCashoutMsg();
                } else {
                    await msg.edit({ embeds: [embed], components }).catch(() => {});
                    await clearCashoutMsg();
                }
            };

            // For 5x5, collect cashout from the separate follow-up message
            if (cashoutMsg) {
                const coCollector = cashoutMsg.createMessageComponentCollector({
                    filter: j => j.user.id === interaction.user.id,
                    time: 300000,
                });
                coCollector.on('collect', async j => {
                    if (gameOver) return;
                    await doCashout(j, true);
                    coCollector.stop();
                });
            }

            gameCollector.on('collect', async j => {
                if (gameOver) return;

                if (j.customId === 'mine_cashout') { await doCashout(j); return; }

                if (!j.customId.startsWith('mine_')) return;
                const idx = parseInt(j.customId.split('_')[1]);
                if (revealed[idx]) return;
                revealed[idx] = true;

                if (mineSet.has(idx)) {
                    gameOver = true;
                    gameCollector.stop('boom');
                    trackWin(user, 0, bet);
                    await user.save();
                    await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                    await clearCashoutMsg();
                    await j.update({ embeds: [minesEmbed('boom')], components: buildGrid(true) });
                    return;
                }

                multiplier = nextMultiplier();
                safeReveals++;

                if (safeReveals === total - mineCount) {
                    gameOver = true;
                    gameCollector.stop('cleared');
                    let payout = parseFloat((bet * multiplier).toFixed(2));
                    let note   = '';
                    ({ winnings: payout, text: note } = applyBoost(user, payout, note));
                    user.balance = parseFloat((user.balance + payout).toFixed(2));
                    trackWin(user, payout, bet);
                    await user.save();
                    await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                    await clearCashoutMsg();
                    await j.update({ embeds: [minesEmbed('cleared')], components: buildGrid(true) });
                    return;
                }

                await j.update({ embeds: [minesEmbed()], components: buildGrid() });
                if (is5x5) await cashoutMsg?.edit({ components: [cashoutRow()] }).catch(() => {});
            });

            gameCollector.on('end', async (_, reason) => {
                if (!gameOver) await doCashout();
            });

            return;
        }

        let winnings = 0, title, text, color;

        if (game === 'slots') {
            const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            title = '🎰 Slots';
            if (spin[0] === spin[1] && spin[1] === spin[2]) {
                winnings = parseFloat((bet * 5).toFixed(2));
                text = `${spin.join(' | ')}\n\nJACKPOT! You won **$${formatNumber(winnings)}**!`;
            } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `${spin.join(' | ')}\n\nYou won **$${formatNumber(winnings)}**!`;
            } else {
                text = `${spin.join(' | ')}\n\nYou lost **$${formatNumber(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else if (game === 'dice') {
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;
            title = '🎲 Dice Roll';
            if (userRoll > botRoll) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${formatNumber(winnings)}**!`;
                color = 0x00ff00;
            } else if (userRoll === botRoll) {
                winnings = bet;
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
                color = 0xffff00;
            } else {
                text = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${formatNumber(bet)}**.`;
                color = 0xff0000;
            }
        }

        if (winnings > 0) ({ winnings, text } = applyBoost(user, winnings, text));
        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor(color)] });
    }
};
