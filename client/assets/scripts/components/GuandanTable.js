cc.Class({
    extends: cc.Component,

    properties: {
        selectedCards: {
            default: [],
            visible: false
        },
        cardNodes: {
            default: [],
            visible: false
        }
    },

    onLoad:function(){
        this.selectedCards = [];
        this.cardNodes = [];
        this.buildTable();
        this.registerEvents();
        this.refreshAll();
    },

    buildTable:function(){
        this.root = new cc.Node('guandan_table_root');
        this.root.parent = this.node;
        this.root.zIndex = 999;
        this.root.setContentSize(cc.winSize);

        var bg = this.root.addComponent(cc.Graphics);
        bg.fillColor = new cc.Color(28, 122, 69, 245);
        bg.roundRect(-cc.winSize.width / 2, -cc.winSize.height / 2, cc.winSize.width, cc.winSize.height, 18);
        bg.fill();

        this.infoLabel = this.createLabel('掼蛋房间', 22, cc.v2(0, cc.winSize.height / 2 - 42), cc.Color.WHITE);
        this.turnLabel = this.createLabel('等待开局', 20, cc.v2(0, cc.winSize.height / 2 - 78), cc.Color.YELLOW);
        this.lastPlayLabel = this.createLabel('上轮出牌：无', 18, cc.v2(0, 40), cc.Color.WHITE);
        this.leftCountLabel = this.createLabel('剩余牌：-', 18, cc.v2(0, 10), cc.Color.WHITE);

        this.handRoot = new cc.Node('hand_cards');
        this.handRoot.parent = this.root;
        this.handRoot.y = -cc.winSize.height / 2 + 90;

        this.playBtn = this.createButton('出牌', cc.v2(-80, -cc.winSize.height / 2 + 35), this.onPlayClicked.bind(this));
        this.passBtn = this.createButton('不要', cc.v2(80, -cc.winSize.height / 2 + 35), this.onPassClicked.bind(this));
    },

    createLabel:function(text, size, pos, color){
        var node = new cc.Node(text);
        node.parent = this.root;
        node.position = pos;
        var label = node.addComponent(cc.Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 4;
        node.color = color || cc.Color.WHITE;
        return label;
    },

    createButton:function(text, pos, cb){
        var node = new cc.Node(text);
        node.parent = this.root;
        node.position = pos;
        node.setContentSize(110, 42);
        var g = node.addComponent(cc.Graphics);
        g.fillColor = new cc.Color(23, 116, 245, 255);
        g.roundRect(-55, -21, 110, 42, 8);
        g.fill();
        var labelNode = new cc.Node('label');
        labelNode.parent = node;
        var label = labelNode.addComponent(cc.Label);
        label.string = text;
        label.fontSize = 20;
        label.lineHeight = 24;
        node.on(cc.Node.EventType.TOUCH_END, cb, this);
        return node;
    },

    registerEvents:function(){
        if(cc.vv == null || cc.vv.gameNetMgr == null){
            return;
        }
        cc.vv.gameNetMgr.dataEventHandler = this.node;
        this.node.on('gd_game_start', this.onGameStart, this);
        this.node.on('gd_sync', this.onSync, this);
        this.node.on('gd_turn', this.onTurn, this);
        this.node.on('gd_play_cards', this.onPlayCards, this);
        this.node.on('gd_pass', this.onPass, this);
        this.node.on('gd_player_finish', this.onPlayerFinish, this);
        this.node.on('gd_round_result', this.onRoundResult, this);
        this.node.on('gd_game_over', this.onGameOver, this);
    },

    refreshAll:function(){
        var mgr = cc.vv && cc.vv.gameNetMgr;
        if(!mgr){
            return;
        }
        if(mgr.roomId){
            this.infoLabel.string = '掼蛋房间 ' + mgr.roomId + '  第 ' + mgr.numOfGames + '/' + mgr.maxNumOfGames + ' 局';
        }
        this.refreshHand();
        this.refreshCounts();
    },

    refreshHand:function(){
        this.handRoot.removeAllChildren();
        this.cardNodes = [];
        this.selectedCards = [];
        var mgr = cc.vv.gameNetMgr;
        var seat = mgr.getSelfData && mgr.getSelfData();
        var holds = seat && seat.holds ? seat.holds.slice() : [];
        if(cc.vv.pokermgr){
            cc.vv.pokermgr.sortCards(holds, mgr.currentLevelRank || 2);
        }
        var startX = -Math.min(holds.length, 27) * 21;
        for(var i = 0; i < holds.length; ++i){
            this.createCardNode(holds[i], cc.v2(startX + i * 42, 0));
        }
    },

    createCardNode:function(card, pos){
        var node = new cc.Node('card_' + card);
        node.parent = this.handRoot;
        node.position = pos;
        node.setContentSize(38, 56);
        node.card = card;
        var g = node.addComponent(cc.Graphics);
        g.fillColor = cc.Color.WHITE;
        g.roundRect(-19, -28, 38, 56, 5);
        g.fill();
        g.strokeColor = new cc.Color(80, 80, 80, 255);
        g.stroke();
        var labelNode = new cc.Node('label');
        labelNode.parent = node;
        var label = labelNode.addComponent(cc.Label);
        label.string = cc.vv.pokermgr ? cc.vv.pokermgr.getCardName(card) : String(card);
        label.fontSize = 16;
        label.lineHeight = 18;
        labelNode.color = cc.vv.pokermgr ? cc.vv.pokermgr.getCardColor(card) : cc.Color.BLACK;
        node.on(cc.Node.EventType.TOUCH_END, function(){
            this.toggleCard(node);
        }, this);
        this.cardNodes.push(node);
    },

    toggleCard:function(node){
        var idx = this.selectedCards.indexOf(node.card);
        if(idx == -1){
            this.selectedCards.push(node.card);
            node.y = 18;
        }
        else{
            this.selectedCards.splice(idx, 1);
            node.y = 0;
        }
    },

    refreshCounts:function(){
        var mgr = cc.vv.gameNetMgr;
        this.leftCountLabel.string = '剩余牌：' + (mgr.leftCounts ? mgr.leftCounts.join(' / ') : '-');
    },

    onGameStart:function(){
        this.turnLabel.string = '游戏开始';
        this.refreshAll();
    },

    onSync:function(){
        this.turnLabel.string = '状态已同步';
        this.refreshAll();
    },

    onTurn:function(data){
        this.turnLabel.string = data.seatIndex == cc.vv.gameNetMgr.seatIndex ? '轮到你出牌' : '等待 ' + data.seatIndex + ' 号位出牌';
    },

    onPlayCards:function(data){
        var names = [];
        var cards = data.cards || [];
        for(var i = 0; i < cards.length; ++i){
            names.push(cc.vv.pokermgr ? cc.vv.pokermgr.getCardName(cards[i]) : cards[i]);
        }
        this.lastPlayLabel.string = '上轮出牌：' + data.seatIndex + '号位 ' + names.join(' ');
        this.refreshAll();
    },

    onPass:function(data){
        this.lastPlayLabel.string = data.seatIndex + '号位 不要';
    },

    onPlayerFinish:function(data){
        this.lastPlayLabel.string = data.seatIndex + '号位 第' + data.order + '名出完';
    },

    onRoundResult:function(data){
        this.turnLabel.string = '本局结束，胜方队伍：' + data.winnerTeam + '，升级：' + data.levelUp;
        this.refreshAll();
    },

    onGameOver:function(){
        this.turnLabel.string = '游戏结束';
    },

    onPlayClicked:function(){
        if(this.selectedCards.length == 0){
            return;
        }
        cc.vv.gameNetMgr.playGuandanCards(this.selectedCards.slice());
    },

    onPassClicked:function(){
        cc.vv.gameNetMgr.passGuandan();
    }
});
