var fs = require('fs');
var path = require('path');

var configPath = path.join(__dirname, '..', 'operation_config.json');
var cached = null;

function defaultConfig(){
    return {
        guandan:{
            costs:{"4":2,"8":3,"16":5},
            rules:{tribute:true,wildCard:false,bombScore:false}
        },
        notice:{version:"20260510",message:"欢迎来到掼蛋房间"},
        app:{version:"20161227",downloadUrl:"http://fir.im/2f17"}
    };
}

function clone(obj){
    return JSON.parse(JSON.stringify(obj));
}

function load(){
    if(cached != null){
        return cached;
    }
    try{
        cached = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    catch(e){
        cached = defaultConfig();
    }
    return cached;
}

function save(conf, callback){
    cached = conf;
    fs.writeFile(configPath, JSON.stringify(conf, null, 2), 'utf8', function(err){
        if(callback){
            callback(err == null);
        }
    });
}

function get(){
    return clone(load());
}

function getGuandanRules(){
    var conf = load();
    return clone(conf.guandan && conf.guandan.rules ? conf.guandan.rules : defaultConfig().guandan.rules);
}

function getGuandanCost(maxGames){
    var conf = load();
    var costs = conf.guandan && conf.guandan.costs ? conf.guandan.costs : defaultConfig().guandan.costs;
    var cost = parseInt(costs[String(maxGames)]);
    if(isNaN(cost) || cost < 0){
        cost = 0;
    }
    return cost;
}

function updateGuandan(data, callback){
    var conf = load();
    conf.guandan = conf.guandan || {};
    conf.guandan.costs = conf.guandan.costs || {};
    conf.guandan.rules = conf.guandan.rules || {};

    if(data.cost4 != null){ conf.guandan.costs["4"] = parseInt(data.cost4) || 0; }
    if(data.cost8 != null){ conf.guandan.costs["8"] = parseInt(data.cost8) || 0; }
    if(data.cost16 != null){ conf.guandan.costs["16"] = parseInt(data.cost16) || 0; }
    if(data.tribute != null){ conf.guandan.rules.tribute = data.tribute == true || data.tribute == "true" || data.tribute == 1 || data.tribute == "1"; }
    if(data.wildCard != null){ conf.guandan.rules.wildCard = data.wildCard == true || data.wildCard == "true" || data.wildCard == 1 || data.wildCard == "1"; }
    if(data.bombScore != null){ conf.guandan.rules.bombScore = data.bombScore == true || data.bombScore == "true" || data.bombScore == 1 || data.bombScore == "1"; }

    save(conf, callback);
}

function updateNotice(data, callback){
    var conf = load();
    conf.notice = conf.notice || {};
    if(data.version != null){ conf.notice.version = String(data.version); }
    if(data.message != null){ conf.notice.message = String(data.message); }
    save(conf, callback);
}

function updateApp(data, callback){
    var conf = load();
    conf.app = conf.app || {};
    if(data.version != null){ conf.app.version = String(data.version); }
    if(data.downloadUrl != null){ conf.app.downloadUrl = String(data.downloadUrl); }
    save(conf, callback);
}

exports.get = get;
exports.getGuandanRules = getGuandanRules;
exports.getGuandanCost = getGuandanCost;
exports.updateGuandan = updateGuandan;
exports.updateNotice = updateNotice;
exports.updateApp = updateApp;
