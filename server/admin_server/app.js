var express = require('express');
var path = require('path');
var db = require('../utils/db');
var http = require('../utils/http');
var crypto = require('../utils/crypto');
var opConfig = require('../utils/op_config');

var app = express();
var config = null;

function checkAdmin(req,res){
    if(config == null || config.ADMIN_KEY == null){
        http.send(res,1,'admin key is not configured');
        return false;
    }
    if(req.query.key != config.ADMIN_KEY){
        http.send(res,403,'invalid admin key');
        return false;
    }
    return true;
}

function safeLike(value){
    if(value == null){
        return '';
    }
    return String(value).replace(/[%_"'\\]/g, '');
}

function toInt(value, def){
    value = parseInt(value);
    if(isNaN(value)){
        return def;
    }
    return value;
}

function sqlString(value){
    if(value == null){
        return '';
    }
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
}

app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    res.header('Access-Control-Allow-Methods','PUT,POST,GET,DELETE,OPTIONS');
    next();
});

app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/api/config', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    http.send(res,0,'ok',opConfig.get());
});

app.get('/api/config/guandan', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    opConfig.updateGuandan(req.query, function(ok){
        http.send(res, ok?0:1, ok?'ok':'save failed', opConfig.get());
    });
});

app.get('/api/config/notice', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    opConfig.updateNotice(req.query, function(ok){
        if(ok){
            var type = sqlString(req.query.type || 'notice');
            var version = sqlString(req.query.version || Date.now());
            var msg = sqlString(req.query.message || '');
            var sql = 'REPLACE INTO t_message(type,msg,version) VALUES("' + type + '","' + msg + '","' + version + '")';
            db.query(sql, function(){
                http.send(res,0,'ok',opConfig.get());
            });
        }
        else{
            http.send(res,1,'save failed');
        }
    });
});

app.get('/api/config/app', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    opConfig.updateApp(req.query, function(ok){
        http.send(res, ok?0:1, ok?'ok':'save failed', opConfig.get());
    });
});

app.get('/api/users', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    var keyword = safeLike(req.query.keyword);
    var sql = 'SELECT userid,account,name,coins,gems,roomid,lv,exp FROM t_users';
    if(keyword != ''){
        sql += ' WHERE account LIKE "%' + keyword + '%" OR userid = ' + (parseInt(keyword) || 0);
    }
    sql += ' ORDER BY userid DESC LIMIT 100';
    db.query(sql, function(err, rows){
        if(err){ http.send(res,1,'query failed'); return; }
        for(var i = 0; i < rows.length; ++i){
            rows[i].name = crypto.fromBase64(rows[i].name);
        }
        http.send(res,0,'ok',{users:rows});
    });
});

app.get('/api/user/gems', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    var userid = toInt(req.query.userid, 0);
    var delta = toInt(req.query.delta, 0);
    if(userid <= 0 || delta == 0){
        http.send(res,1,'invalid parameters');
        return;
    }
    db.add_user_gems(userid, delta, function(ok){
        http.send(res, ok?0:1, ok?'ok':'update failed');
    });
});

app.get('/api/rooms', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    var sql = 'SELECT uuid,id,base_info,create_time,num_of_turns,next_button,user_id0,user_name0,user_score0,user_id1,user_name1,user_score1,user_id2,user_name2,user_score2,user_id3,user_name3,user_score3,ip,port FROM t_rooms ORDER BY create_time DESC LIMIT 100';
    db.query(sql, function(err, rows){
        if(err){ http.send(res,1,'query failed'); return; }
        for(var i = 0; i < rows.length; ++i){
            rows[i].user_name0 = crypto.fromBase64(rows[i].user_name0);
            rows[i].user_name1 = crypto.fromBase64(rows[i].user_name1);
            rows[i].user_name2 = crypto.fromBase64(rows[i].user_name2);
            rows[i].user_name3 = crypto.fromBase64(rows[i].user_name3);
        }
        http.send(res,0,'ok',{rooms:rows});
    });
});

app.get('/api/history', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    var userid = toInt(req.query.userid, 0);
    if(userid <= 0){
        http.send(res,1,'invalid userid');
        return;
    }
    db.get_user_history(userid, function(history){
        http.send(res,0,'ok',{history:history || []});
    });
});

app.get('/api/summary', function(req,res){
    if(!checkAdmin(req,res)){ return; }
    var ret = {};
    db.query('SELECT COUNT(*) AS c FROM t_users', function(err, rows){
        ret.users = err ? 0 : rows[0].c;
        db.query('SELECT COUNT(*) AS c FROM t_rooms', function(err2, rows2){
            ret.rooms = err2 ? 0 : rows2[0].c;
            db.query('SELECT COUNT(*) AS c FROM t_users WHERE roomid IS NOT NULL', function(err3, rows3){
                ret.inRoomUsers = err3 ? 0 : rows3[0].c;
                http.send(res,0,'ok',ret);
            });
        });
    });
});

exports.start = function($config){
    config = $config;
    app.listen(config.ADMIN_PORT, config.ADMIN_IP);
    console.log('admin server is listening on ' + config.ADMIN_IP + ':' + config.ADMIN_PORT);
};
