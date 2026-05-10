var configs = require(process.argv[2]);
var db = require('../utils/db');
db.init(configs.mysql());
var admin = require('./app');
admin.start(configs.admin_server());
