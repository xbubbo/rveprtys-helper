const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, anticheat } = require('../utils/economy');

const SYMBOLS    = ['🍒', '🍋', '🍉', '⭐', '💎', '🍀'];
const RED_NUMS   = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CARD_VALS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS      = ['♠','♥','♦','♣'];

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function shuffledDeck() {
    const deck = SUITS.flatMap(s => CARD_VALS.map(v => ({ v, s })));
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardPoints(card) {
    if (['J','Q','K'].includes(card.v)) return 10;
    if (card.v === 'A') return 11;
    return parseInt(card.v);
}

function handTotal(hand) {
    let total = hand.reduce((a, c) => a + cardPoints(c), 0);
    let aces  = hand.filter(c => c.v === 'A').length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}

function showHand(hand) {
    return hand.map(c => `\`${c.v}${c.s}\``).join(' ');
}

function cardRank(card) {
    return CARD_VALS.indexOf(card.v);
}

function trackWin(user, winnings, bet) {
    user.gamblingWinnings = parseFloat(((user.gamblingWinnings ?? 0) + winnings - bet).toFixed(2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Play a gambling game')
        .addStringOption(o =>
            o.setName('game').setDescription('Game to play').setRequired(true)
                .addChoices(
                    { name: 'Slots',      value: 'slots'      },
                    { name: 'Coinflip',   value: 'coinflip'   },
                    { name: 'Dice',       value: 'dice'       },
                    { name: 'Roulette',   value: 'roulette'   },
                    { name: 'Blackjack',  value: 'blackjack'  },
                    { name: 'High / Low', value: 'highlow'    }
                )
        )
        .addIntegerOption(o =>
            o.setName('bet').setDescription('Amount to bet').setRequired(true)
        )
        .addStringOption(o =>
            o.setName('choice')
                .setDescription('Coinflip: heads/tails | Roulette: red, black, or a number 0-36')
                .setRequired(false)
        ),

    async execute(interaction) {
        const game   = interaction.options.getString('game');
        const bet    = interaction.options.getInteger('bet');
        const choice = interaction.options.getString('choice')?.toLowerCase() ?? null;

        if (game === 'coinflip' && !['heads','tails','h','t'].includes(choice))
            return interaction.reply({ content: '❌ For coinflip pick `heads` or `tails`.', ephemeral: true });

        if (game === 'roulette' && !choice)
            return interaction.reply({ content: '❌ For roulette specify `red`, `black`, or a number 0-36 in the choice field.', ephemeral: true });

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
                if (pBJ && dBJ) { winnings = bet;                                result = `Both Blackjack - Push, bet refunded.`; }
                else if (pBJ)   { winnings = parseFloat((bet * 2.5).toFixed(2)); result = `Blackjack! You won **$${fmt(winnings)}**!`; }
                else            {                                                  result = `Dealer Blackjack. You lost **$${fmt(bet)}**.`; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Blackjack')
                    .setDescription(`Your hand: ${showHand(playerHand)} = **${handTotal(playerHand)}**\nDealer: ${showHand(dealerHand)} = **${handTotal(dealerHand)}**\n\n${result}`)
                    .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)] });
            }

            await user.save();

            const bjEmbed = (pHand, extra = '') => new EmbedBuilder()
                .setTitle('Blackjack')
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
                if (pVal > 21)        { result = `Bust! You lost **$${fmt(bet)}**.`; }
                else if (dVal > 21)   { winnings = parseFloat((bet * 2).toFixed(2)); result = `Dealer busts! You won **$${fmt(winnings)}**!`; }
                else if (pVal > dVal) { winnings = parseFloat((bet * 2).toFixed(2)); result = `You win! You won **$${fmt(winnings)}**!`; }
                else if (pVal < dVal) { result = `Dealer wins. You lost **$${fmt(bet)}**.`; }
                else                  { winnings = bet; result = `Push - bet refunded.`; }
                user.balance = parseFloat((user.balance + winnings).toFixed(2));
                trackWin(user, winnings, bet);
                await user.save();
                await anticheat(interaction.client, interaction.user.id, interaction.guild.id);
                const embed = new EmbedBuilder().setTitle('Blackjack')
                    .setDescription(`Your hand: ${showHand(pHand)} = **${pVal}**\nDealer: ${showHand(dHand)} = **${dVal}**\n\n${result}`)
                    .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000);
                if (i) await i.update({ embeds: [embed], components: [] });
                else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
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

        if (game === 'highlow') {
            await user.save();
            const deck = shuffledDeck();
            let currentCard = deck.pop();
            let multiplier  = 1;

            const hlEmbed = (card, mult, extra = '') => new EmbedBuilder()
                .setTitle('High / Low')
                .setDescription(
                    `Current card: \`${card.v}${card.s}\`\n` +
                    `Multiplier: **${mult.toFixed(2)}x** - Potential payout: **$${fmt(parseFloat((bet * mult).toFixed(2)))}**\n\n` +
                    (extra || 'Will the next card be higher or lower?')
                )
                .setColor(0x2b2d31);

            const hlButtons = (mult) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hl_high').setLabel('Higher ▲').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('hl_low').setLabel('Lower ▼').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('hl_cash').setLabel(`Cash Out ($${fmt(parseFloat((bet * mult).toFixed(2)))})`).setStyle(ButtonStyle.Secondary)
            );

            const msg = await interaction.reply({ embeds: [hlEmbed(currentCard, multiplier)], components: [hlButtons(multiplier)], fetchReply: true });

            const cashOut = async (i, mult, timedOut = false) => {
                const payout = parseFloat((bet * mult).toFixed(2));
                user.balance = parseFloat((user.balance + payout).toFixed(2));
                trackWin(user, payout, bet);
                await user.save();
                const embed = new EmbedBuilder().setTitle('High / Low')
                    .setDescription(timedOut
                        ? `Timed out - auto cashed out at **${mult.toFixed(2)}x**!\nYou received **$${fmt(payout)}**.`
                        : `Cashed out at **${mult.toFixed(2)}x**! You won **$${fmt(payout)}**!`)
                    .setColor(payout > bet ? 0x00ff00 : 0xffff00);
                if (i) await i.update({ embeds: [embed], components: [] });
                else   await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
            };

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'hl_cash') { collector.stop('done'); await cashOut(i, multiplier); return; }

                const nextCard  = deck.pop();
                const currRank  = cardRank(currentCard);
                const nextRank  = cardRank(nextCard);

                if (nextRank === currRank) {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('High / Low')
                        .setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Equal! You lost **$${fmt(bet)}**.`)
                        .setColor(0xff0000)], components: [] });
                    return;
                }

                const correct = i.customId === 'hl_high' ? nextRank > currRank : nextRank < currRank;
                if (correct) {
                    multiplier    = parseFloat((multiplier * 1.8).toFixed(2));
                    currentCard   = nextCard;
                    await i.update({ embeds: [hlEmbed(currentCard, multiplier, `Correct! Keep going or cash out.`)], components: [hlButtons(multiplier)] });
                } else {
                    collector.stop('done');
                    trackWin(user, 0, bet);
                    await user.save();
                    await i.update({ embeds: [new EmbedBuilder().setTitle('High / Low')
                        .setDescription(`Next card: \`${nextCard.v}${nextCard.s}\` - Wrong! You lost **$${fmt(bet)}**.`)
                        .setColor(0xff0000)], components: [] });
                }
            });

            collector.on('end', async (_, reason) => { if (reason !== 'done') await cashOut(null, multiplier, true); });
            return;
        }

        let winnings = 0, title, text, color;

        if (game === 'slots') {
            const spin = [0, 1, 2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            title = 'Slots';
            if (spin[0] === spin[1] && spin[1] === spin[2]) {
                winnings = parseFloat((bet * 5).toFixed(2));
                text = `${spin.join(' | ')}\n\nJACKPOT! You won **$${fmt(winnings)}**!`;
            } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `${spin.join(' | ')}\n\nYou won **$${fmt(winnings)}**!`;
            } else {
                text = `${spin.join(' | ')}\n\nYou lost **$${fmt(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else if (game === 'coinflip') {
            const pick   = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice;
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            title = 'Coinflip';
            if (pick === result) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text = `Coin landed on **${result}**\nYou won **$${fmt(winnings)}**!`;
            } else {
                text = `Coin landed on **${result}**\nYou lost **$${fmt(bet)}**.`;
            }
            color = winnings ? 0x00ff00 : 0xff0000;

        } else if (game === 'dice') {
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll  = Math.floor(Math.random() * 6) + 1;
            title = 'Dice Roll';
            if (userRoll > botRoll) {
                winnings = parseFloat((bet * 2).toFixed(2));
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou won **$${fmt(winnings)}**!`;
                color = 0x00ff00;
            } else if (userRoll === botRoll) {
                winnings = bet;
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nTie - bet refunded.`;
                color = 0xffff00;
            } else {
                text  = `You: **${userRoll}** | Bot: **${botRoll}**\nYou lost **$${fmt(bet)}**.`;
                color = 0xff0000;
            }

        } else if (game === 'roulette') {
            const spin      = Math.floor(Math.random() * 37);
            const spinColor = spin === 0 ? 'green' : RED_NUMS.has(spin) ? 'red' : 'black';
            const emoji     = { red: '🔴', black: '⚫', green: '🟢' }[spinColor];
            title = 'Roulette';
            const numBet = parseInt(choice);
            if (!isNaN(numBet) && numBet >= 0 && numBet <= 36) {
                if (spin === numBet) {
                    winnings = parseFloat((bet * 35).toFixed(2));
                    text  = `${emoji} **${spin}**\nHit **${numBet}**! You won **$${fmt(winnings)}**!`;
                } else {
                    text = `${emoji} **${spin}**\nYou bet **${numBet}** - You lost **$${fmt(bet)}**.`;
                }
            } else if (choice === 'red' || choice === 'black') {
                if (spinColor === choice) {
                    winnings = parseFloat((bet * 2).toFixed(2));
                    text  = `${emoji} **${spin}**\nYou bet **${choice}** - You won **$${fmt(winnings)}**!`;
                } else {
                    text = `${emoji} **${spin}**\nYou bet **${choice}** - You lost **$${fmt(bet)}**.`;
                }
            } else {
                user.balance = parseFloat((user.balance + bet).toFixed(2));
                await user.save();
                return interaction.reply({ content: '❌ For roulette choose `red`, `black`, or a number 0-36.', ephemeral: true });
            }
            color = winnings ? 0x00ff00 : 0xff0000;
        }

        user.balance = parseFloat((user.balance + winnings).toFixed(2));
        trackWin(user, winnings, bet);
        await user.save();
        await anticheat(interaction.client, interaction.user.id, interaction.guild.id);

        return interaction.reply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(text).setColor(color)] });
    }
};
