var Db = require('mongodb').Db,
    Connection = require('mongodb').Connection,
    Server = require('mongodb').Server,
    async = require('async'),
    local = require("../local.config.js");

var host = local.config.db_config.host
    ? local.config.db_config.host
    : 'localhost';
var port = local.config.db_config.port
    ? local.config.db_config.port
    : Connection.DEFAULT_PORT;
var ps = local.config.db_config.poolSize
    ? local.config.db_config.poolSize : 5;

var db = new Db('RTChat',
                new Server(host, port,
                           { auto_reconnect: true,
                             poolSize: ps}),
                { w: 1 });

/**
 * Currently for initialisation, we just want to open
 * the database.  We won't even attempt to start up
 * if this fails, as it's pretty pointless.
 */
exports.init = function (callback) {
    async.waterfall([
        // 1. open database connection
        function (cb) {
            console.log("\n** 1. open db");
            db.open(cb);
        },

        // 2. create collections for our albums and photos. if
        //    they already exist, then we're good.
        function (db_conn, cb) {
            console.log("\n** 2. create chats and users.");
            db.collection("chats", cb);
        },

        function (users_coll, cb) {
            exports.users = users_coll;
            db.collection("users", cb);
        },

        function (chats_coll, cb) {
            exports.chats = chats_coll;
            cb(null);
        }
    ], callback);
};


exports.users = null;
exports.chats = null;
