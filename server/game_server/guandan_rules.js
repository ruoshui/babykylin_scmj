var poker = require('./poker_utils');

var PATTERN = {
    SINGLE:'single',
    PAIR:'pair',
    TRIPLE:'triple',
    FULL_HOUSE:'full_house',
    STRAIGHT:'straight',
    PAIR_STRAIGHT:'pair_straight',
    TRIPLE_STRAIGHT:'triple_straight',
    BOMB:'bomb',
    STRAIGHT_FLUSH:'straight_flush',
    JOKER_BOMB:'joker_bomb'
};

function makeInvalid(reason){
    return {valid:false, reason:reason};
}

function getContext(context){
    context = context || {};
    context.levelRank = poker.normalizeLevelRank(context.levelRank);
    context.conf = context.conf || {};
    return context;
}

function groupByPower(cards, context){
    var map = {};
    for(var i = 0; i < cards.length; ++i){
        var power = poker.getCardPower(cards[i], context.levelRank);
        if(map[power] == null){
            map[power] = [];
        }
        map[power].push(cards[i]);
    }
    return map;
}

function getSortedPowers(map){
    var powers = [];
    for(var k in map){
        powers.push(parseInt(k));
    }
    powers.sort(function(a,b){return a - b;});
    return powers;
}

function isConsecutive(powers){
    if(powers.length == 0){
        return false;
    }
    for(var i = 0; i < powers.length; ++i){
        // 顺子类不允许 2、级牌、王参与。A 的 power 为 13，2 为 14，级牌为 15。
        if(powers[i] >= 14){
            return false;
        }
        if(i > 0 && powers[i] != powers[i - 1] + 1){
            return false;
        }
    }
    return true;
}

function makePattern(type, cards, mainRank, extra){
    extra = extra || {};
    return {
        valid:true,
        type:type,
        cards:cards.slice(),
        mainRank:mainRank,
        length:cards.length,
        bombLevel:extra.bombLevel || 0
    };
}

function analyzePlay(cards, context){
    context = getContext(context);
    if(cards == null || cards.length == 0){
        return makeInvalid('empty cards');
    }

    cards = cards.slice();
    poker.sortCards(cards, context.levelRank);

    var map = groupByPower(cards, context);
    var powers = getSortedPowers(map);
    var len = cards.length;

    if(len == 4){
        var jokerCount = 0;
        for(var j = 0; j < cards.length; ++j){
            if(poker.isJoker(cards[j])){
                jokerCount++;
            }
        }
        if(jokerCount == 4){
            return makePattern(PATTERN.JOKER_BOMB, cards, 17, {bombLevel:100});
        }
    }

    if(powers.length == 1){
        var power = powers[0];
        if(len == 1){
            return makePattern(PATTERN.SINGLE, cards, power);
        }
        if(len == 2){
            return makePattern(PATTERN.PAIR, cards, power);
        }
        if(len == 3){
            return makePattern(PATTERN.TRIPLE, cards, power);
        }
        if(len >= 4){
            return makePattern(PATTERN.BOMB, cards, power, {bombLevel:len});
        }
    }

    if(len == 5 && powers.length == 2){
        var triplePower = null;
        var pairPower = null;
        for(var a = 0; a < powers.length; ++a){
            var p = powers[a];
            if(map[p].length == 3){
                triplePower = p;
            }
            else if(map[p].length == 2){
                pairPower = p;
            }
        }
        if(triplePower != null && pairPower != null){
            return makePattern(PATTERN.FULL_HOUSE, cards, triplePower);
        }
    }

    if(len >= 5 && powers.length == len && isConsecutive(powers)){
        var suit = poker.cardToSuit(cards[0]);
        var sameSuit = suit >= 0;
        for(var sf = 1; sf < cards.length; ++sf){
            if(poker.cardToSuit(cards[sf]) != suit){
                sameSuit = false;
                break;
            }
        }
        if(sameSuit && len == 5){
            return makePattern(PATTERN.STRAIGHT_FLUSH, cards, powers[powers.length - 1], {bombLevel:6});
        }
        return makePattern(PATTERN.STRAIGHT, cards, powers[powers.length - 1]);
    }

    if(len >= 6 && len % 2 == 0 && powers.length == len / 2 && isConsecutive(powers)){
        var allPairs = true;
        for(var pp = 0; pp < powers.length; ++pp){
            if(map[powers[pp]].length != 2){
                allPairs = false;
                break;
            }
        }
        if(allPairs){
            return makePattern(PATTERN.PAIR_STRAIGHT, cards, powers[powers.length - 1]);
        }
    }

    if(len >= 6 && len % 3 == 0 && powers.length == len / 3 && isConsecutive(powers)){
        var allTriples = true;
        for(var tp = 0; tp < powers.length; ++tp){
            if(map[powers[tp]].length != 3){
                allTriples = false;
                break;
            }
        }
        if(allTriples){
            return makePattern(PATTERN.TRIPLE_STRAIGHT, cards, powers[powers.length - 1]);
        }
    }

    return makeInvalid('unsupported pattern');
}

function isBomb(pattern){
    return pattern != null && pattern.valid && (
        pattern.type == PATTERN.BOMB ||
        pattern.type == PATTERN.STRAIGHT_FLUSH ||
        pattern.type == PATTERN.JOKER_BOMB
    );
}

function canBeat(candidate, lastPlay, context){
    if(candidate == null || candidate.valid != true){
        return false;
    }
    if(lastPlay == null || lastPlay.valid != true){
        return true;
    }

    if(candidate.type == PATTERN.JOKER_BOMB){
        return lastPlay.type != PATTERN.JOKER_BOMB;
    }
    if(lastPlay.type == PATTERN.JOKER_BOMB){
        return false;
    }

    var candidateBomb = isBomb(candidate);
    var lastBomb = isBomb(lastPlay);
    if(candidateBomb || lastBomb){
        if(candidateBomb == false){
            return false;
        }
        if(lastBomb == false){
            return true;
        }
        if(candidate.bombLevel != lastPlay.bombLevel){
            return candidate.bombLevel > lastPlay.bombLevel;
        }
        return candidate.mainRank > lastPlay.mainRank;
    }

    if(candidate.type != lastPlay.type || candidate.length != lastPlay.length){
        return false;
    }
    return candidate.mainRank > lastPlay.mainRank;
}

function calcTeamIndex(seatIndex){
    return seatIndex % 2;
}

function calcLevelUp(finishOrder){
    if(finishOrder == null || finishOrder.length < 4){
        return {winnerTeam:-1, levelUp:0};
    }
    var firstTeam = calcTeamIndex(finishOrder[0]);
    var secondTeam = calcTeamIndex(finishOrder[1]);
    if(firstTeam == secondTeam){
        return {winnerTeam:firstTeam, levelUp:3};
    }

    var thirdTeam = calcTeamIndex(finishOrder[2]);
    if(firstTeam == thirdTeam){
        return {winnerTeam:firstTeam, levelUp:2};
    }
    return {winnerTeam:firstTeam, levelUp:1};
}

function advanceLevel(levelRank, delta){
    levelRank = poker.normalizeLevelRank(levelRank);
    delta = delta || 0;
    for(var i = 0; i < delta; ++i){
        levelRank++;
        if(levelRank == 15){
            levelRank = 2;
        }
    }
    return levelRank;
}

exports.PATTERN = PATTERN;
exports.analyzePlay = analyzePlay;
exports.canBeat = canBeat;
exports.isBomb = isBomb;
exports.calcTeamIndex = calcTeamIndex;
exports.calcLevelUp = calcLevelUp;
exports.advanceLevel = advanceLevel;
