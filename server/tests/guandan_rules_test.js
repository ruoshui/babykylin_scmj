var assert = require('assert');
var poker = require('../game_server/poker_utils');
var rules = require('../game_server/guandan_rules');

function card(copy, suit, rank){
    var rankIndex = rank == 14 ? 0 : rank - 1;
    return copy * 52 + suit * 13 + rankIndex;
}

function analyze(cards, levelRank){
    return rules.analyzePlay(cards, {levelRank:levelRank || 2, conf:{wildCard:false}});
}

assert.equal(poker.newDeck().length, 108);
assert.equal(poker.cardToRank(card(0, 0, 14)), 14);
assert.equal(poker.cardToRank(card(1, 3, 13)), 13);
assert.equal(poker.isSmallJoker(104), true);
assert.equal(poker.isBigJoker(107), true);
assert.equal(poker.getCardPower(card(0, 0, 2), 2), 15);
assert.equal(poker.getCardPower(card(0, 0, 2), 3), 14);
assert.equal(poker.getCardPower(card(0, 0, 3), 3), 15);

var single = analyze([card(0, 0, 3)]);
assert.equal(single.valid, true);
assert.equal(single.type, rules.PATTERN.SINGLE);

var pair = analyze([card(0, 0, 4), card(1, 2, 4)]);
assert.equal(pair.valid, true);
assert.equal(pair.type, rules.PATTERN.PAIR);

var triple = analyze([card(0, 0, 5), card(0, 1, 5), card(1, 2, 5)]);
assert.equal(triple.valid, true);
assert.equal(triple.type, rules.PATTERN.TRIPLE);

var fullHouse = analyze([card(0, 0, 6), card(0, 1, 6), card(1, 2, 6), card(0, 0, 7), card(1, 1, 7)]);
assert.equal(fullHouse.valid, true);
assert.equal(fullHouse.type, rules.PATTERN.FULL_HOUSE);

var straight = analyze([card(0, 0, 3), card(0, 1, 4), card(0, 2, 5), card(0, 3, 6), card(1, 0, 7)]);
assert.equal(straight.valid, true);
assert.equal(straight.type, rules.PATTERN.STRAIGHT);

var straightFlush = analyze([card(0, 0, 3), card(0, 0, 4), card(0, 0, 5), card(0, 0, 6), card(0, 0, 7)]);
assert.equal(straightFlush.valid, true);
assert.equal(straightFlush.type, rules.PATTERN.STRAIGHT_FLUSH);

var pairStraight = analyze([card(0, 0, 8), card(1, 0, 8), card(0, 1, 9), card(1, 1, 9), card(0, 2, 10), card(1, 2, 10)]);
assert.equal(pairStraight.valid, true);
assert.equal(pairStraight.type, rules.PATTERN.PAIR_STRAIGHT);

var bomb4 = analyze([card(0, 0, 9), card(0, 1, 9), card(1, 2, 9), card(1, 3, 9)]);
var bomb5 = analyze([card(0, 0, 10), card(0, 1, 10), card(0, 2, 10), card(1, 0, 10), card(1, 1, 10)]);
assert.equal(bomb4.type, rules.PATTERN.BOMB);
assert.equal(bomb5.type, rules.PATTERN.BOMB);
assert.equal(rules.canBeat(bomb4, straight), true);
assert.equal(rules.canBeat(bomb5, bomb4), true);

var jokerBomb = analyze([104, 105, 106, 107]);
assert.equal(jokerBomb.type, rules.PATTERN.JOKER_BOMB);
assert.equal(rules.canBeat(jokerBomb, bomb5), true);
assert.equal(rules.canBeat(bomb5, jokerBomb), false);

var pair5 = analyze([card(0, 0, 5), card(1, 0, 5)]);
assert.equal(rules.canBeat(pair5, pair), true);
assert.equal(rules.canBeat(pair, pair5), false);
assert.equal(rules.canBeat(single, pair), false);

var level = rules.calcLevelUp([0, 2, 1, 3]);
assert.equal(level.winnerTeam, 0);
assert.equal(level.levelUp, 3);
assert.equal(rules.advanceLevel(13, 2), 2);

console.log('guandan_rules_test passed');
