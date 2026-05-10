// 扑克牌工具：掼蛋使用两副牌，共 108 张。
// 编码：0-103 为两副 A-K，104/106 小王，105/107 大王。

var RANK_A = 14;
var RANK_2 = 2;
var RANK_K = 13;

function normalizeLevelRank(levelRank){
    levelRank = parseInt(levelRank);
    if(isNaN(levelRank) || levelRank < 2 || levelRank > 14){
        return RANK_2;
    }
    return levelRank;
}

function isJoker(card){
    return card >= 104 && card <= 107;
}

function isSmallJoker(card){
    return card == 104 || card == 106;
}

function isBigJoker(card){
    return card == 105 || card == 107;
}

function cardToCopy(card){
    if(isJoker(card)){
        return card >= 106 ? 1 : 0;
    }
    return Math.floor(card / 52);
}

function cardToSuit(card){
    if(isJoker(card)){
        return -1;
    }
    return Math.floor((card % 52) / 13);
}

function cardToRank(card){
    if(isSmallJoker(card)){
        return 16;
    }
    if(isBigJoker(card)){
        return 17;
    }

    var rankIndex = card % 13;
    if(rankIndex == 0){
        return RANK_A;
    }
    return rankIndex + 1;
}

function isWildCard(card, levelRank, conf){
    conf = conf || {};
    if(conf.wildCard != true){
        return false;
    }
    levelRank = normalizeLevelRank(levelRank);
    // 黑桃级牌作为逢人配。
    return cardToSuit(card) == 3 && cardToRank(card) == levelRank;
}

function getCardPower(card, levelRank){
    if(isSmallJoker(card)){
        return 16;
    }
    if(isBigJoker(card)){
        return 17;
    }

    levelRank = normalizeLevelRank(levelRank);
    var rank = cardToRank(card);
    if(rank == levelRank){
        return 15;
    }
    if(rank == RANK_A){
        return 13;
    }
    if(rank == RANK_2){
        return 14;
    }
    return rank - 1;
}

function sortCards(cards, levelRank){
    cards.sort(function(a,b){
        var pa = getCardPower(a, levelRank);
        var pb = getCardPower(b, levelRank);
        if(pa != pb){
            return pa - pb;
        }
        var sa = cardToSuit(a);
        var sb = cardToSuit(b);
        if(sa != sb){
            return sa - sb;
        }
        return a - b;
    });
    return cards;
}

function newDeck(){
    var deck = [];
    for(var i = 0; i < 108; ++i){
        deck.push(i);
    }
    return deck;
}

function shuffle(deck){
    for(var i = deck.length - 1; i > 0; --i){
        var j = Math.floor(Math.random() * (i + 1));
        var t = deck[i];
        deck[i] = deck[j];
        deck[j] = t;
    }
    return deck;
}

function createShuffledDeck(){
    return shuffle(newDeck());
}

function removeCards(source, cards){
    var copy = source.slice();
    for(var i = 0; i < cards.length; ++i){
        var idx = copy.indexOf(cards[i]);
        if(idx == -1){
            return null;
        }
        copy.splice(idx, 1);
    }
    return copy;
}

function hasCards(source, cards){
    return removeCards(source, cards) != null;
}

exports.RANK_A = RANK_A;
exports.RANK_2 = RANK_2;
exports.RANK_K = RANK_K;
exports.normalizeLevelRank = normalizeLevelRank;
exports.isJoker = isJoker;
exports.isSmallJoker = isSmallJoker;
exports.isBigJoker = isBigJoker;
exports.cardToCopy = cardToCopy;
exports.cardToSuit = cardToSuit;
exports.cardToRank = cardToRank;
exports.isWildCard = isWildCard;
exports.getCardPower = getCardPower;
exports.sortCards = sortCards;
exports.newDeck = newDeck;
exports.shuffle = shuffle;
exports.createShuffledDeck = createShuffledDeck;
exports.removeCards = removeCards;
exports.hasCards = hasCards;
