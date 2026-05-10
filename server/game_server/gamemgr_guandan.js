var crypto = require('../utils/crypto');
var db = require('../utils/db');
var roomMgr = require('./roommgr');
var userMgr = require('./usermgr');
var poker = require('./poker_utils');
var rules = require('./guandan_rules');

var games = {};
var dissolvingList = [];

function getSeatData(game, userId){
    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null || game == null){
        return null;
    }
    return game.gameSeats[seatIndex];
}

function broadcastGame(game, event, data){
    if(game == null || game.gameSeats.length == 0){
        return;
    }
    userMgr.broacastInRoom(event, data, game.gameSeats[0].userId, true);
}

function sendError(userId, event, errmsg){
    userMgr.sendMsg(userId, event, {errcode:1, errmsg:errmsg});
}

function activeSeatCount(game){
    var count = 0;
    for(var i = 0; i < game.gameSeats.length; ++i){
        if(game.finishOrder.indexOf(i) == -1){
            count++;
        }
    }
    return count;
}

function nextActiveSeat(game, fromSeat){
    for(var i = 1; i <= game.gameSeats.length; ++i){
        var seatIndex = (fromSeat + i) % game.gameSeats.length;
        if(game.finishOrder.indexOf(seatIndex) == -1){
            return seatIndex;
        }
    }
    return -1;
}

function getLeftCounts(game){
    var counts = [];
    for(var i = 0; i < game.gameSeats.length; ++i){
        counts.push(game.gameSeats[i].holds.length);
    }
    return counts;
}

function buildPublicSeats(game){
    var seats = [];
    for(var i = 0; i < game.gameSeats.length; ++i){
        var sd = game.gameSeats[i];
        seats.push({
            userid:sd.userId,
            seatIndex:sd.seatIndex,
            teamIndex:sd.teamIndex,
            leftCount:sd.holds.length,
            rankThisRound:sd.rankThisRound,
            score:sd.score
        });
    }
    return seats;
}

function buildSyncData(game, seatIndex){
    var data = {
        state:game.state,
        levelRankByTeam:game.levelRankByTeam,
        currentLevelRank:game.currentLevelRank,
        bankerSeat:game.bankerSeat,
        turnSeat:game.turnSeat,
        lastPlay:game.lastPlay,
        passSeats:game.passSeats,
        finishOrder:game.finishOrder,
        numofgames:game.roomInfo.numOfGames,
        seats:buildPublicSeats(game),
        leftCounts:getLeftCounts(game)
    };
    if(seatIndex != null && game.gameSeats[seatIndex] != null){
        data.holds = game.gameSeats[seatIndex].holds;
    }
    return data;
}

function sendTurn(game){
    if(game.state != 'playing' || game.turnSeat < 0){
        return;
    }
    var seatData = game.gameSeats[game.turnSeat];
    userMgr.sendMsg(seatData.userId, 'gd_turn_push', {
        seatIndex:game.turnSeat,
        canPass:game.lastPlay != null,
        lastPlay:game.lastPlay
    });
    broadcastGame(game, 'gd_turn_notify_push', {
        seatIndex:game.turnSeat,
        canPass:game.lastPlay != null,
        lastPlay:game.lastPlay
    });
}

function constructGameBaseInfo(game){
    var baseInfo = {
        type:game.conf.type,
        index:game.gameIndex,
        levelRankByTeam:game.levelRankByTeam,
        currentLevelRank:game.currentLevelRank,
        bankerSeat:game.bankerSeat,
        deck:game.deck,
        game_seats:[]
    };
    for(var i = 0; i < game.gameSeats.length; ++i){
        baseInfo.game_seats.push(game.gameSeats[i].holds.slice());
    }
    return JSON.stringify(baseInfo);
}

function storeGame(game, callback){
    db.create_game(game.roomInfo.uuid, game.gameIndex, constructGameBaseInfo(game), callback);
}

function resetRoomReady(roomInfo){
    for(var i = 0; i < roomInfo.seats.length; ++i){
        roomInfo.seats[i].ready = false;
    }
}

function doRoundOver(game){
    game.state = 'round_over';

    for(var i = 0; i < game.gameSeats.length; ++i){
        if(game.finishOrder.indexOf(i) == -1){
            game.finishOrder.push(i);
            game.gameSeats[i].rankThisRound = game.finishOrder.length;
        }
    }

    var levelInfo = rules.calcLevelUp(game.finishOrder);
    if(levelInfo.winnerTeam >= 0){
        game.levelRankByTeam[levelInfo.winnerTeam] = rules.advanceLevel(
            game.levelRankByTeam[levelInfo.winnerTeam],
            levelInfo.levelUp
        );
    }

    var scoreByRank = [3, 1, -1, -3];
    for(var rank = 0; rank < game.finishOrder.length; ++rank){
        var seatIndex = game.finishOrder[rank];
        var seatData = game.gameSeats[seatIndex];
        seatData.score += scoreByRank[rank] || 0;
        game.roomInfo.seats[seatIndex].score += scoreByRank[rank] || 0;
    }

    var result = {
        finishOrder:game.finishOrder,
        winnerTeam:levelInfo.winnerTeam,
        levelUp:levelInfo.levelUp,
        levelRankByTeam:game.levelRankByTeam,
        scores:[]
    };
    for(var i = 0; i < game.gameSeats.length; ++i){
        result.scores.push({
            seatIndex:i,
            userId:game.gameSeats[i].userId,
            score:game.gameSeats[i].score,
            totalScore:game.roomInfo.seats[i].score
        });
    }

    game.roomInfo.nextButton = game.finishOrder[0];
    db.update_next_button(game.roomInfo.id, game.roomInfo.nextButton);
    db.update_game_action_records(game.roomInfo.uuid, game.gameIndex, JSON.stringify(game.actionList));
    db.update_num_of_turns(game.roomInfo.id, game.roomInfo.numOfGames);

    broadcastGame(game, 'gd_round_result_push', result);

    var isEnd = game.roomInfo.numOfGames >= game.conf.maxGames;
    if(isEnd){
        broadcastGame(game, 'gd_game_over_push', {results:result.scores});
    }

    delete games[game.roomInfo.id];
    resetRoomReady(game.roomInfo);
}

function recordAction(game, type, data){
    game.actionList.push({type:type, data:data});
}

function finishSeatIfNeeded(game, seatData){
    if(seatData.holds.length > 0){
        return false;
    }
    if(game.finishOrder.indexOf(seatData.seatIndex) == -1){
        game.finishOrder.push(seatData.seatIndex);
        seatData.rankThisRound = game.finishOrder.length;
        broadcastGame(game, 'gd_player_finish_push', {
            seatIndex:seatData.seatIndex,
            order:seatData.rankThisRound
        });
    }
    return activeSeatCount(game) <= 1;
}

exports.setReady = function(userId, callback){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    roomMgr.setReady(userId, true);

    var game = games[roomId];
    if(game != null){
        var seatIndex = roomMgr.getUserSeat(userId);
        userMgr.sendMsg(userId, 'gd_sync_push', buildSyncData(game, seatIndex));
        sendTurn(game);
        return;
    }

    if(roomInfo.seats.length == 4){
        for(var i = 0; i < roomInfo.seats.length; ++i){
            var s = roomInfo.seats[i];
            if(s.userId <= 0 || s.ready == false || userMgr.isOnline(s.userId) == false){
                return;
            }
        }
        exports.begin(roomId);
    }
};

exports.begin = function(roomId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null || games[roomId] != null){
        return;
    }

    var game = {
        conf:roomInfo.conf,
        roomInfo:roomInfo,
        gameIndex:roomInfo.numOfGames,
        state:'dealing',
        deck:poker.createShuffledDeck(),
        gameSeats:new Array(4),
        levelRankByTeam:roomInfo.levelRankByTeam || [roomInfo.conf.startLevel, roomInfo.conf.startLevel],
        currentLevelRank:roomInfo.conf.startLevel,
        bankerSeat:roomInfo.nextButton || 0,
        turnSeat:roomInfo.nextButton || 0,
        lastPlay:null,
        passSeats:[],
        finishOrder:[],
        actionList:[]
    };

    game.currentLevelRank = game.levelRankByTeam[rules.calcTeamIndex(game.bankerSeat)];
    roomInfo.levelRankByTeam = game.levelRankByTeam;
    roomInfo.numOfGames++;

    for(var i = 0; i < 4; ++i){
        var seat = roomInfo.seats[i];
        game.gameSeats[i] = {
            game:game,
            userId:seat.userId,
            seatIndex:i,
            teamIndex:rules.calcTeamIndex(i),
            holds:[],
            score:0,
            rankThisRound:0,
            tributeCard:null,
            returnedCard:null
        };
    }

    for(var cardIndex = 0; cardIndex < game.deck.length; ++cardIndex){
        game.gameSeats[cardIndex % 4].holds.push(game.deck[cardIndex]);
    }
    for(var s = 0; s < 4; ++s){
        poker.sortCards(game.gameSeats[s].holds, game.currentLevelRank);
    }

    games[roomId] = game;
    recordAction(game, 'deal', {bankerSeat:game.bankerSeat, levelRank:game.currentLevelRank});

    storeGame(game, function(){
        game.state = 'playing';
        for(var i = 0; i < 4; ++i){
            userMgr.sendMsg(game.gameSeats[i].userId, 'gd_game_start_push', {
                levelRank:game.currentLevelRank,
                levelRankByTeam:game.levelRankByTeam,
                bankerSeat:game.bankerSeat,
                turnSeat:game.turnSeat,
                holds:game.gameSeats[i].holds,
                leftCounts:getLeftCounts(game),
                seats:buildPublicSeats(game)
            });
        }
        if(roomInfo.numOfGames == 1){
            db.cost_gems(game.gameSeats[0].userId, roomInfo.conf.cost || 0);
        }
        sendTurn(game);
    });
};

exports.playCards = function(userId, cards){
    var roomId = roomMgr.getUserRoom(userId);
    var game = games[roomId];
    var seatData = getSeatData(game, userId);
    if(game == null || seatData == null || game.state != 'playing'){
        return;
    }
    if(game.turnSeat != seatData.seatIndex){
        sendError(userId, 'gd_play_cards_result', 'not your turn');
        return;
    }
    if(cards == null || cards.length == 0 || poker.hasCards(seatData.holds, cards) == false){
        sendError(userId, 'gd_play_cards_result', 'cards not in hand');
        return;
    }

    var pattern = rules.analyzePlay(cards, {levelRank:game.currentLevelRank, conf:game.conf});
    if(pattern.valid != true){
        sendError(userId, 'gd_play_cards_result', pattern.reason);
        return;
    }
    if(rules.canBeat(pattern, game.lastPlay == null? null:game.lastPlay.pattern, {levelRank:game.currentLevelRank, conf:game.conf}) == false){
        sendError(userId, 'gd_play_cards_result', 'can not beat last play');
        return;
    }

    seatData.holds = poker.removeCards(seatData.holds, cards);
    poker.sortCards(seatData.holds, game.currentLevelRank);
    game.lastPlay = {
        seatIndex:seatData.seatIndex,
        cards:cards.slice(),
        pattern:pattern
    };
    game.passSeats = [];
    recordAction(game, 'play', game.lastPlay);

    userMgr.sendMsg(userId, 'gd_play_cards_result', {errcode:0});
    broadcastGame(game, 'gd_play_cards_notify_push', {
        seatIndex:seatData.seatIndex,
        cards:cards,
        pattern:pattern,
        leftCount:seatData.holds.length,
        leftCounts:getLeftCounts(game)
    });

    if(finishSeatIfNeeded(game, seatData)){
        doRoundOver(game);
        return;
    }

    game.turnSeat = nextActiveSeat(game, seatData.seatIndex);
    sendTurn(game);
};

exports.pass = function(userId){
    var roomId = roomMgr.getUserRoom(userId);
    var game = games[roomId];
    var seatData = getSeatData(game, userId);
    if(game == null || seatData == null || game.state != 'playing'){
        return;
    }
    if(game.turnSeat != seatData.seatIndex){
        sendError(userId, 'gd_pass_result', 'not your turn');
        return;
    }
    if(game.lastPlay == null){
        sendError(userId, 'gd_pass_result', 'first player can not pass');
        return;
    }

    if(game.passSeats.indexOf(seatData.seatIndex) == -1){
        game.passSeats.push(seatData.seatIndex);
    }
    recordAction(game, 'pass', {seatIndex:seatData.seatIndex});

    userMgr.sendMsg(userId, 'gd_pass_result', {errcode:0});
    broadcastGame(game, 'gd_pass_notify_push', {seatIndex:seatData.seatIndex});

    var lastPlaySeatActive = game.finishOrder.indexOf(game.lastPlay.seatIndex) == -1;
    var passNeeded = activeSeatCount(game) - (lastPlaySeatActive ? 1 : 0);
    if(game.passSeats.length >= passNeeded){
        game.turnSeat = game.lastPlay.seatIndex;
        if(game.finishOrder.indexOf(game.turnSeat) != -1){
            game.turnSeat = nextActiveSeat(game, game.turnSeat);
        }
        game.lastPlay = null;
        game.passSeats = [];
        broadcastGame(game, 'gd_trick_over_push', {nextSeat:game.turnSeat});
        sendTurn(game);
        return;
    }

    game.turnSeat = nextActiveSeat(game, seatData.seatIndex);
    sendTurn(game);
};

exports.hasBegan = function(roomId){
    var game = games[roomId];
    if(game != null){
        return true;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo != null){
        return roomInfo.numOfGames > 0;
    }
    return false;
};

exports.doDissolve = function(roomId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }
    var game = games[roomId];
    if(game != null){
        broadcastGame(game, 'gd_game_over_push', {dissolved:true});
        delete games[roomId];
    }
    userMgr.kickAllInRoom(roomId);
    roomMgr.destroy(roomId);
};

exports.dissolveRequest = function(roomId,userId){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null || roomInfo.dr != null){
        return null;
    }
    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    roomInfo.dr = {
        endTime:Date.now() + 30000,
        states:[false,false,false,false]
    };
    roomInfo.dr.states[seatIndex] = true;
    dissolvingList.push(roomId);
    return roomInfo;
};

exports.dissolveAgree = function(roomId,userId,agree){
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null || roomInfo.dr == null){
        return null;
    }
    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    if(agree){
        roomInfo.dr.states[seatIndex] = true;
    }
    else{
        roomInfo.dr = null;
        var idx = dissolvingList.indexOf(roomId);
        if(idx != -1){
            dissolvingList.splice(idx, 1);
        }
    }
    return roomInfo;
};

function update(){
    for(var i = dissolvingList.length - 1; i >= 0; --i){
        var roomId = dissolvingList[i];
        var roomInfo = roomMgr.getRoom(roomId);
        if(roomInfo != null && roomInfo.dr != null){
            if(Date.now() > roomInfo.dr.endTime){
                exports.doDissolve(roomId);
                dissolvingList.splice(i, 1);
            }
        }
        else{
            dissolvingList.splice(i, 1);
        }
    }
}

setInterval(update, 1000);
