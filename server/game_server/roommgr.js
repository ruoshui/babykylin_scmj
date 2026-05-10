var db = require('../utils/db');
var opConfig = require('../utils/op_config');

var rooms = {};
var creatingRooms = {};

var userLocation = {};
var totalRooms = 0;

var GUANDAN_JU_SHU = [4,8,16];

function getGameMgr(){
	return require("./gamemgr_guandan");
}

function generateRoomId(){
	var roomId = "";
	for(var i = 0; i < 6; ++i){
		roomId += Math.floor(Math.random()*10);
	}
	return roomId;
}

function constructRoomFromDb(dbdata){
	var roomInfo = {
		uuid:dbdata.uuid,
		id:dbdata.id,
		numOfGames:dbdata.num_of_turns,
		createTime:dbdata.create_time,
		nextButton:dbdata.next_button,
		seats:new Array(4),
		conf:JSON.parse(dbdata.base_info)
	};


	roomInfo.gameMgr = getGameMgr();
	var roomId = roomInfo.id;

	for(var i = 0; i < 4; ++i){
		var s = roomInfo.seats[i] = {};
		s.userId = dbdata["user_id" + i];
		s.score = dbdata["user_score" + i];
		s.name = dbdata["user_name" + i];
		s.ready = false;
		s.seatIndex = i;
		s.numFirstPlace = 0;
		s.numLastPlace = 0;
		s.numBomb = 0;
		s.numTribute = 0;
		s.numLevelUp = 0;

		if(s.userId > 0){
			userLocation[s.userId] = {
				roomId:roomId,
				seatIndex:i
			};
		}
	}
	rooms[roomId] = roomInfo;
	totalRooms++;
	return roomInfo;
}

function getRoomConfIndex(value, values){
	value = parseInt(value);
	if(isNaN(value)){
		return -1;
	}
	if(value >= 0 && value < values.length){
		return value;
	}
	for(var i = 0; i < values.length; ++i){
		if(values[i] == value){
			return i;
		}
	}
	return -1;
}

function parseBoolean(value, defaultValue){
	if(value == null){
		return defaultValue;
	}
	return value == true || value == 1 || value == "true";
}

function buildGuandanConf(creator, roomConf){
	if(roomConf == null){
		return null;
	}
	if(roomConf.type != null && roomConf.type != "guandan"){
		return null;
	}
	var jushuIndex = getRoomConfIndex(roomConf.jushuxuanze != null? roomConf.jushuxuanze:roomConf.maxGames, GUANDAN_JU_SHU);
	if(jushuIndex < 0){
		return null;
	}
	var startLevel = parseInt(roomConf.startLevel || roomConf.startlevel || 2);
	if(isNaN(startLevel) || startLevel < 2 || startLevel > 14){
		return null;
	}
	var baseScore = parseInt(roomConf.baseScore || roomConf.difen || 1);
	if(isNaN(baseScore) || baseScore <= 0){
		baseScore = 1;
	}
	var maxGames = GUANDAN_JU_SHU[jushuIndex];
	var defaultRules = opConfig.getGuandanRules();
	return {
		type:"guandan",
		baseScore:baseScore,
		maxGames:maxGames,
		startLevel:startLevel,
		tribute:parseBoolean(roomConf.tribute, defaultRules.tribute),
		wildCard:parseBoolean(roomConf.wildCard, defaultRules.wildCard),
		bombScore:parseBoolean(roomConf.bombScore, defaultRules.bombScore),
		creator:creator,
		cost:opConfig.getGuandanCost(maxGames)
	};
}

exports.createRoom = function(creator,roomConf,gems,ip,port,callback){
	var conf = buildGuandanConf(creator, roomConf);
	if(conf == null){
		callback(1,null);
		return;
	}
	
	var cost = conf.cost || 0;
	if(cost > gems){
		callback(2222,null);
		return;
	}

	var fnCreate = function(){
		var roomId = generateRoomId();
		if(rooms[roomId] != null || creatingRooms[roomId] != null){
			fnCreate();
		}
		else{
			creatingRooms[roomId] = true;
			db.is_room_exist(roomId, function(ret) {

				if(ret){
					delete creatingRooms[roomId];
					fnCreate();
				}
				else{
					var createTime = Math.ceil(Date.now()/1000);
					var roomInfo = {
						uuid:"",
						id:roomId,
						numOfGames:0,
						createTime:createTime,
						nextButton:0,
						seats:[],
						conf:conf
					};
					
					roomInfo.gameMgr = getGameMgr();
					console.log(roomInfo.conf);
					
					for(var i = 0; i < 4; ++i){
						roomInfo.seats.push({
							userId:0,
							score:0,
							name:"",
							ready:false,
							seatIndex:i,
							numFirstPlace:0,
							numLastPlace:0,
							numBomb:0,
							numTribute:0,
							numLevelUp:0
						});
					}
					

					//写入数据库
					db.create_room(roomInfo.id,roomInfo.conf,ip,port,createTime,function(uuid){
						delete creatingRooms[roomId];
						if(uuid != null){
							roomInfo.uuid = uuid;
							console.log(uuid);
							rooms[roomId] = roomInfo;
							totalRooms++;
							callback(0,roomId);
						}
						else{
							callback(3,null);
						}
					});
				}
			});
		}
	}

	fnCreate();
};

exports.destroy = function(roomId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return;
	}

	for(var i = 0; i < 4; ++i){
		var userId = roomInfo.seats[i].userId;
		if(userId > 0){
			delete userLocation[userId];
			db.set_room_id_of_user(userId,null);
		}
	}
	
	delete rooms[roomId];
	totalRooms--;
	db.delete_room(roomId);
}

exports.getTotalRooms = function(){
	return totalRooms;
}

exports.getRoom = function(roomId){
	return rooms[roomId];
};

exports.isCreator = function(roomId,userId){
	var roomInfo = rooms[roomId];
	if(roomInfo == null){
		return false;
	}
	return roomInfo.conf.creator == userId;
};

exports.enterRoom = function(roomId,userId,userName,callback){
	var fnTakeSeat = function(room){
		if(exports.getUserRoom(userId) == roomId){
			//已存在
			return 0;
		}

		for(var i = 0; i < 4; ++i){
			var seat = room.seats[i];
			if(seat.userId <= 0){
				seat.userId = userId;
				seat.name = userName;
				userLocation[userId] = {
					roomId:roomId,
					seatIndex:i
				};
				//console.log(userLocation[userId]);
				db.update_seat_info(roomId,i,seat.userId,"",seat.name);
				//正常
				return 0;
			}
		}	
		//房间已满
		return 1;	
	}
	var room = rooms[roomId];
	if(room){
		var ret = fnTakeSeat(room);
		callback(ret);
	}
	else{
		db.get_room_data(roomId,function(dbdata){
			if(dbdata == null){
				//找不到房间
				callback(2);
			}
			else{
				//construct room.
				room = constructRoomFromDb(dbdata);
				//
				var ret = fnTakeSeat(room);
				callback(ret);
			}
		});
	}
};

exports.setReady = function(userId,value){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	s.ready = value;
}

exports.isReady = function(userId){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	return s.ready;	
}


exports.getUserRoom = function(userId){
	var location = userLocation[userId];
	if(location != null){
		return location.roomId;
	}
	return null;
};

exports.getUserSeat = function(userId){
	var location = userLocation[userId];
	//console.log(userLocation[userId]);
	if(location != null){
		return location.seatIndex;
	}
	return null;
};

exports.getUserLocations = function(){
	return userLocation;
};

exports.exitRoom = function(userId){
	var location = userLocation[userId];
	if(location == null)
		return;

	var roomId = location.roomId;
	var seatIndex = location.seatIndex;
	var room = rooms[roomId];
	delete userLocation[userId];
	if(room == null || seatIndex == null) {
		return;
	}

	var seat = room.seats[seatIndex];
	seat.userId = 0;
	seat.name = "";

	var numOfPlayers = 0;
	for(var i = 0; i < room.seats.length; ++i){
		if(room.seats[i].userId > 0){
			numOfPlayers++;
		}
	}
	
	db.set_room_id_of_user(userId,null);

	if(numOfPlayers == 0){
		exports.destroy(roomId);
	}
};