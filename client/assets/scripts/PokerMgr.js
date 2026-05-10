var ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
var suits = ['♦','♣','♥','♠'];

cc.Class({
    extends: cc.Component,

    properties: {},

    cardToRank:function(card){
        if(card == 104 || card == 106){
            return 16;
        }
        if(card == 105 || card == 107){
            return 17;
        }
        var idx = card % 13;
        if(idx == 0){
            return 14;
        }
        return idx + 1;
    },

    cardToSuit:function(card){
        if(card >= 104){
            return -1;
        }
        return Math.floor((card % 52) / 13);
    },

    getCardName:function(card){
        if(card == 104 || card == 106){
            return '小王';
        }
        if(card == 105 || card == 107){
            return '大王';
        }
        var suit = this.cardToSuit(card);
        var rankIndex = card % 13;
        return suits[suit] + ranks[rankIndex];
    },

    getCardColor:function(card){
        var suit = this.cardToSuit(card);
        if(card == 105 || card == 107 || suit == 0 || suit == 2){
            return cc.Color.RED;
        }
        return cc.Color.BLACK;
    },

    getCardPower:function(card, levelRank){
        if(card == 104 || card == 106){
            return 16;
        }
        if(card == 105 || card == 107){
            return 17;
        }
        levelRank = levelRank || 2;
        var rank = this.cardToRank(card);
        if(rank == levelRank){
            return 15;
        }
        if(rank == 14){
            return 13;
        }
        if(rank == 2){
            return 14;
        }
        return rank - 1;
    },

    sortCards:function(cards, levelRank){
        var self = this;
        cards.sort(function(a,b){
            var pa = self.getCardPower(a, levelRank);
            var pb = self.getCardPower(b, levelRank);
            if(pa != pb){
                return pa - pb;
            }
            return a - b;
        });
        return cards;
    }
});
