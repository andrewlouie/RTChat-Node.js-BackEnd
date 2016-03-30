var alpha = require('../alphabet.js'),
db = require('./db.js'),
async = require('async'),
bcrypt = require('bcryptjs'),
chats_data = require('./chats.js'),
mongo = require('mongodb');

//if I don't do this in a try/catch it will crash everything
function mongoObj(id) {
  try {
    return new mongo.ObjectID(id);
  }
  catch (err) {
    return id;
  }
}
//helper function to get info on friends and chats stored separately
function populate(user,callback) {
  async.waterfall([
    function(cb) {
      if (!user.Friends.length) { cb(null); return; }
      db.users.find({ _id: { $in : user.Friends } },{ UserName : 1, ProfilePic: 1,Name: 1,TagLine: 1,CookieString:1,LastCheck:1 },{safe: true}).toArray(function(err, results) {
        if (err) cb(err);
        else {
          user.Friends = results;
          cb(null);
        }
      });
    },
    function (cb) {
      for (i=0;i<user.Friends.length;i++) {
        user.Friends[i] = { UserName: user.Friends[i].UserName,ProfilePic: user.Friends[i].ProfilePic,TagLine: user.Friends[i].TagLine,Name:user.Friends[i].Name,OnlineStatus: OnlineStatus(user.Friends[i].CookieString,user.Friends[i].LastCheck),_id:user.Friends[i]._id }
      }
      cb(null);
    },
    function(cb) {
      if (!user.BlockedUsers.length) { cb(null); return; }
      db.users.find({ _id: { $in : user.BlockedUsers } },{ UserName : 1 },{safe: true}).toArray(function(err, results) {
        if (err) cb(err);
        else {
          user.BlockedUsers = results;
          cb(null);
        }
      });
    },
    function (cb) {
      db.chats.find({ $or: [{ UsersInChat: { $elemMatch : { $eq: user._id } } },{ InvitedUsers: { $elemMatch : { $eq: user._id } } }] }).toArray(function(err, results) {
        if (err) cb(err);
        else {
          user.Chats = results;
          (function iterator(i) {
          if (i < user.Chats.length) {
            chats_data.populate(user.Chats[i],function(err,populatedchat) {
              if (err) cb(err);
              else {
                user.Chats[i] = populatedchat;
                iterator(i+1);
              }
            });
          }
          else { cb(null,user); }
          })(0);
        }
      });
    }
  ],
  function(err, results) {
    if (err) {
        callback(err);
    } else {
        callback(err, err ? null : results);
    }
  });
};
//authorization function done before most functions.  returns true if authorized and the user if found
exports.auth = auth;
function auth(data, callback) {
  var id = mongoObj(data.userid);
    db.users.find({ "_id" : id}).toArray(function(err, result) {
      if (err) callback(err);
      else if (result.length > 0) {
        if (result[0].CookieString == data.cookie && (result[0].StayLoggedIn || result[0].LastCheck > new Date(new Date().getTime() - 30*60*1000)))
          callback(null, true, result[0]);
        else callback(null, false, result[0]);
      }
      else callback(null, false);
    });
};
//create user for register
exports.create_user = function (data, callback) {
    var created_user = {};
    async.waterfall([
        // validate data.
        function (cb) {
            db.users.find({ "UserName" :  { $regex: "^" + data.username + '$', $options: "-i" } }).toArray(function(err, result) {
              if (err) cb(err);
              else {
                if (result.length > 0) cb(36);
                else {
                  var patt1 = /^(?=[a-zA-Z])[-\w.]{0,23}$/;
        		      var patt2 = /^(?=[^\d_].*?\d)\w(\w|[!@#$%]){7,20}/;
        		      var patt3 = /^[a-zA-Z]+(([\'\,\.\- ][a-zA-Z ])?[a-zA-Z]*)*$/;
        		      var patt4 = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,6}$/;
        	      	if (!patt3.test(data.name)) cb(24);
                  else if (!patt1.test(data.username)) cb(22);
                  else if (!patt2.test(data.password)) cb(19);
                  else if (!patt4.test(data.email)) cb(23);
                  else cb(null, data);
                }
              }
            });
        },
        function(user_data, cb) {
          bcrypt.genSalt(10, function(err, salt) {
            created_user.Salt = salt;
            bcrypt.hash(user_data.password, salt, function(err, hash) {
              created_user.Password = hash;
              bcrypt.genSalt(10, function(err, salt) {
                created_user.CookieString = salt;
                cb(null, data);
              });
            });
          });
        },
        function (user_data, cb) {
            created_user.Name = user_data.name;
            created_user.Email =  user_data.email;
            created_user.UserName = user_data.username;
            created_user.ProfilePic = alpha.Alphabet(user_data.username.charAt(0));
            created_user.TagLine = "I'm new here";
            created_user.RegisteredDate = new Date();
            created_user.AutoJoinChats = false;
            created_user.StayLoggedIn = false;
            created_user.LastCheck = new Date();
            created_user.Friends = [];
            created_user.BlockedUsers = [];
            created_user.Updates = [];
            created_user.isGuest = false;
            db.users.insert(created_user, { w: 1, safe: true }, cb);
        }
    ],
    function (err, results) {
        // convert file errors to something we like.
        if (err) {
                callback(err);
        } else {
            callback(err, err ? null : created_user);
        }
    });
};
//login
exports.login = function (data, callback) {
    async.waterfall([
//LOOK UP USER
        function (cb) {
          var patt1 = /^(?=[a-zA-Z])[-\w.]{0,23}$/;
          if (!patt1.test(data.username)) { cb(6); return; }
            db.users.find({ "UserName" :  { $regex: "^" + data.username + '$', $options: "-i" } }).toArray(function(err, result) {
              if (err) cb(err);
              else {
                if (result.length == 0) cb(6);
                else {
                  cb(null,data,result[0]);
                }
              }
            });
        },
        //validate password
        function(user_data, dbuser, cb) {
          bcrypt.hash(user_data.password, dbuser.Salt, function(err, hash) {
              if (err) cb(err);
              else if (hash != dbuser.Password && dbuser.ResetPassword != user_data.password) cb(7);
              else cb(null, dbuser,user_data);
            });
        },
        //update 'stayloggedin' checkbox and lastcheck date and cookie
        function(dbuser, user_data, cb) {
          bcrypt.genSalt(10, function(err, salt) {
            var sli = (user_data.stayloggedin == "true"?true:false);
            db.users.findAndModify({ "_id" : dbuser._id },[],{ $set : { StayLoggedIn : sli,CookieString: salt,LastCheck : new Date() },$pull: { Updates: { isChatUpdate: true } } },{new:true},function(err,result) {
              if (err) cb(err);
              else {
                cb(null,result);
              }
            });
          });
        },
        function (dbuser, cb) {
          populate(dbuser,function(err, updateduser) {
            if (err) cb(err);
            else cb(null,updateduser);
          });
        }
    ],
    function (err, results) {
        if (err) {
                callback(err);
        } else {
            callback(err, err ? null : results);
        }
    });
};
//search for users
exports.search = function(searchterm, cb) {
    async.waterfall([
//LOOK UP USER
        function (cb) {
            db.users.find({ "UserName" :  { $regex: searchterm, $options: '-i' } },{ UserName: 1,ProfilePic: 1,isGuest : 1,Name:1 }).limit(20).toArray(function(err, results) {
              if (err) cb(err);
              else {
                db.users.count({ "UserName" :  { $regex: searchterm, $options: '-i' } },function(err,count) {
                  if (err) cb(err);
                  else cb(null, results, count);
                });
              }
            });
        },
    ],
    function (err, results, count) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results, err ? null : count);
        }
    });
};
//return true if user name is already taken
exports.searchexact = function(searchterm, cb) {
    async.waterfall([
        function (cb) {
            db.users.find({ "UserName" :  { $regex: '^' + searchterm + '$', $options: '-i' } }).toArray(function(err, results) {
              if (err) cb(err);
              else cb(null,results.length > 0);
            });
        },
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};
//relogin
exports.relogin = function (dbuser, callback) {
    async.waterfall([
        //update lastcheck date and cookie
        function(cb) {
          bcrypt.genSalt(10, function(err, salt) {
            db.users.findAndModify({ "_id" : dbuser._id },[],{ $set : { CookieString: salt,LastCheck : new Date() },$pull: { Updates: { isChatUpdate: true } } },{new:true},function(err,result) {
              if (err) cb(err);
              else {
                cb(null,result);
              }
            });
          });
        },
        function (dbuser, cb) {
          populate(dbuser,function(err, updateduser) {
            if (err) cb(err);
            else cb(null,updateduser);
          });
        }
    ],
    function (err, results) {
        if (err) {
            callback(err);
        } else {
            callback(err, err ? null : results);
        }
    });
};

exports.logout = function (dbuser, callback) {
    async.waterfall([
        //remove cookie
        function(cb) {
          db.users.update({ "_id" : dbuser._id },{ $unset : { CookieString: "" }},{safe:true},function(err,result) {
            if (err) cb(err);
            else {
              cb(null);
            }
          });
        },
        //if you're a guest you must leave chats because you can't log back in as a guest
        function(cb) {
          if (!dbuser.isGuest) { cb(null, true); return; }
          db.chats.find({ UsersInChat: { $elemMatch : { $eq: dbuser._id } } }).toArray(function(err, results) {
            if (err) cb(err);
              (function iterator6(i) {
                if (i < results.length) {
                  chats_data.leavechat(dbuser,results[i]._id, function(err, results) {
                    iterator6(i+1);
                  });
                }
                else cb(null, true);
              })(0);
            });
        }
    ],
    function (err, results) {
        if (err) {
            callback(err);
        } else {
            callback(err, err ? null : results);
        }
    });
};
function OnlineStatus(cookiestring,lastcheck) {
  if (cookiestring && lastcheck > new Date(new Date().getTime() - 5*60*1000)) return true;
  return false;
}
exports.friendinfo = function(friendid, cb) {
    async.waterfall([
        function (cb) {
          var id = mongoObj(friendid);
            db.users.find({ "_id" : id },{ UserName: 1,ProfilePic: 1,TagLine: 1,Name: 1,CookieString:1,LastCheck:1 }).toArray(function(err, result) {
              if (err) cb(err);
              else if (result.length != 0) {
                result[0].OnlineStatus = OnlineStatus(result[0].CookieString,result[0].LastCheck);
                delete result[0].CookieString;
                delete result[0].LastCheck;
                cb(null,result[0]);
              }
              else {
                cb(6);
              }
            });
        },
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.updateprofile = function(dbuser, data, cb) {
    async.waterfall([
      //validation
        function (cb) {
          var patt1 = /^(?=[a-zA-Z])[-\w.]{0,23}$/;
          var patt3 = /^[a-zA-Z]+(([\'\,\.\- ][a-zA-Z ])?[a-zA-Z]*)*$/;
          var patt4 = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,6}$/;
          if (!patt3.test(data.name)) cb(24);
          else if (!patt1.test(data.username)) cb(22);
          else if (!patt4.test(data.email)) cb(23);
          else if (data.username.toLowerCase() != dbuser.UserName.toLowerCase()) {
            db.users.find({ "UserName" : { $regex: '^' + searchterm + '$', $options: '-i' } }).toArray(function(err, result) {
              if (err) cb(err);
              else {
                if (result.length > 0) cb(36);
                else {
                  cb(null);
                }
              }
            });
        }
        else cb(null);
        },
        //update
        function(cb) {
          data.autojoinchats = (data.autojoinchats?true:false);
          data.tagline = (data.tagline?data.tagline:"");
          db.users.update({ "_id" : dbuser._id },{ $set : { UserName : data.username,Name: data.name,Email : data.email,TagLine: data.tagline,AutoJoinChats:data.autojoinchats } },{safe:true},function(err,result) {
            if (err) cb(err);
            else cb(null, true);
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.blockuser = function(dbuser, blockeduserid, cb) {
    async.waterfall([
      //get the other user
      function (cb) {
        auth({ userid: blockeduserid },function (err, result, otheruser) {
          if (err) cb (err);
          else if (otheruser == null) cb(6);
          else cb(null, otheruser);
        });
        },
        //check if they're already blocked
        function (otheruser, cb) {
          var newarray = [];
          for (i=0;i<dbuser.BlockedUsers.length;i++) {
            newarray.push(dbuser.BlockedUsers[i].toString());
          }
          dbuser.BlockedUsers = newarray;
          if (dbuser.BlockedUsers.indexOf(blockeduserid) != -1) cb(32);
          else cb(null,otheruser);
        },
        //update
        function(otheruser,cb) {
          db.users.update({"_id":dbuser._id},{ $push: { BlockedUsers : otheruser._id } },{safe: true},function(err, result) {
            if (err) cb(err);
            else cb(null, true);
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.addfriend = function(dbuser, friendid, cb) {
    async.waterfall([
      //get the other user
      function (cb) {
        auth({ userid: friendid },function (err, result, otheruser) {
          if (err) cb (err);
          else if (otheruser == null) cb(6);
          else cb(null, otheruser);
        });
        },
        //check if they're already your friend
        function (otheruser, cb) {
          if (otheruser.isGuest) { cb(25); return; }
          var newarray = [];
          for (i=0;i<dbuser.Friends.length;i++) {
            newarray.push(dbuser.Friends[i].toString());
          }
          dbuser.Friends = newarray;
          if (dbuser.Friends.indexOf(friendid) != -1) cb(26);
          else cb(null,otheruser);
        },
        //update, return friend object
        function(otheruser,cb) {
          db.users.update({"_id":dbuser._id},{ $push: { Friends : otheruser._id } },{safe: true},function(err, result) {
            if (err) cb(err);
            else cb(null, { UserName: otheruser.UserName,ProfilePic: otheruser.ProfilePic,TagLine: otheruser.TagLine,Name:otheruser.Name,OnlineStatus: OnlineStatus(otheruser.CookieString,otheruser.LastCheck),_id:otheruser._id });
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.unblock = function(dbuser, otheruserid, cb) {
    async.waterfall([
      //get the other user
      function (cb) {
        auth({ userid: otheruserid },function (err, result, otheruser) {
          if (err) cb (err);
          else if (otheruser == null) cb(6);
          else cb(null, otheruser);
        });
        },
        //check if they're blocked
        function (otheruser, cb) {
          var newarray = [];
          for (i=0;i<dbuser.BlockedUsers.length;i++) {
            newarray.push(dbuser.BlockedUsers[i].toString());
          }
          dbuser.BlockedUsers = newarray;
          if (dbuser.BlockedUsers.indexOf(otheruserid) == -1) cb(31);
          else cb(null,otheruser);
        },
        //update
        function(otheruser,cb) {
          db.users.update({"_id":dbuser._id},{ $pull: { BlockedUsers : otheruser._id } },{safe: true},function(err, result) {
            if (err) cb(err);
            else cb(null, true);
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.unfriend = function(dbuser, otheruserid, cb) {
    async.waterfall([
      //get the other user
      function (cb) {
        auth({ userid: otheruserid },function (err, result, otheruser) {
          if (err) cb (err);
          else if (otheruser == null) cb(6);
          else cb(null, otheruser);
        });
        },
        //check if they're a friend
        function (otheruser, cb) {
          var newarray = [];
          for (i=0;i<dbuser.Friends.length;i++) {
            newarray.push(dbuser.Friends[i].toString());
          }
          dbuser.Friends = newarray;
          if (dbuser.Friends.indexOf(otheruserid) == -1) cb(29);
          else cb(null,otheruser);
        },
        //update
        function(otheruser,cb) {
          db.users.update({"_id":dbuser._id},{ $pull: { Friends : otheruser._id } },{safe: true},function(err, result) {
            if (err) cb(err);
            else cb(null, true);
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};

exports.updatepassword = function(dbuser, data, cb) {
    async.waterfall([
      //validation
        function (cb) {
          var patt2 = /^(?=[^\d_].*?\d)\w(\w|[!@#$%]){7,20}/;
          if (!patt2.test(data.newpassword)) cb(19);
          else {
            bcrypt.hash(data.oldpassword, dbuser.Salt, function(err, hash) {
                if (err) cb(err);
                else if (hash != dbuser.Password && dbuser.ResetPassword != data.oldpassword) cb(18);
                else cb(null);
              });
          }
        },
        //update
        function(cb) {
          bcrypt.genSalt(10, function(err, salt) {
            if (err) cb(err);
            else {
            bcrypt.hash(data.newpassword, salt, function(err, hash) {
              if (err) cb(err);
              else cb(null,hash,salt);
            });
            }
          });
        },
        function(hash, salt, cb) {
          db.users.update({ "_id" : dbuser._id },{ $set : { Password : hash,Salt: salt },$unset : { ResetPassword : "" } },{safe:true},function(err,result) {
            if (err) cb(err);
            else cb(null, true);
          });
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};
//guest login/create guest user
exports.guestlogin = function (username, callback) {
    var created_user = {};
    async.waterfall([
        // validate data.
        function (cb) {
          var patt1 = /^(?=[a-zA-Z])[-\w.]{0,16}$/;
          if (!patt1.test(username)) { cb(22); return; }
          db.users.find({ "UserName" :  { $regex: "^\\+Guest\\-" + username + '$', $options: "-i" } }).toArray(function(err, result) {
            if (err) cb(err);
            else {
              if (result.length > 0) cb(36);
              else cb(null);
            }
          });
        },
        function(cb) {
          bcrypt.genSalt(10, function(err, salt) {
            if (err) cb(err);
            else {
              created_user.CookieString = salt;
              cb(null);
            }
          });
        },
        function (cb) {
          created_user.Name = "Guest User";
          created_user.UserName = "+Guest-" + username;
          created_user.isGuest = true;
          created_user.RegisteredDate = new Date();
          created_user.LastCheck = new Date();
          created_user.Friends = [];
          created_user.BlockedUsers = [];
          created_user.Updates = [];
          created_user.AutoJoinChats = false;
          db.users.insert(created_user, { w: 1, safe: true }, cb);
        }
    ],
    function (err, results) {
        // convert file errors to something we like.
        if (err) {
                callback(err);
        } else {
            callback(err, err ? null : created_user);
        }
    });
};
//guest login/create guest user
exports.receive = function (dbuser, callback) {
    async.waterfall([
      //each chat update, populate the chat
        function (cb) {
          (function iterator5(i) {
            if (i < dbuser.Updates.length) {
              if (dbuser.Updates[i].isChatUpdate) {
                db.chats.find({ "_id": dbuser.Updates[i].ChatId }).toArray(function(err, results) {
                  if (results.length == 0) { iterator5(i+1); dbuser.Updates[i].Chat = {}; dbuser.Updates[i].Chat._id = dbuser.Updates[i].ChatId; dbuser.Updates[i].Chat.UsersInChat = []; dbuser.Updates[i].Chat.InvitedUsers = []; }
                  else {
                    chats_data.populate(results[0], function(err, populatedchat) {
                      dbuser.Updates[i].Chat = populatedchat;
                      iterator5(i+1);
                    });
                  }
                });
              }
              else iterator5(i+1);
            }
            else cb(null);
          })(0);
        },
        //remove chat updates from db and update lastcheck
        function(cb) {
          db.users.update({ "_id": dbuser._id },{ $pull: { Updates: { isChatUpdate: true } },$set: { LastCheck : new Date() } },{multi:true},function(err, result) {
            if (err) cb(err);
            else cb(null);
          });
        },
    ],
    function (err, results) {
        if (err) {
            callback(err);
        } else {
            callback(err, err ? null : dbuser);
        }
    });
};
//get friends
exports.getfriends = function(dbuser, cb) {
    async.waterfall([
        function (cb) {
          if (!dbuser.Friends.length) { cb(null,0); return; }
          db.users.find({ _id: { $in : dbuser.Friends } },{ UserName : 1, ProfilePic: 1,Name: 1,TagLine: 1,CookieString: 1,LastCheck:1},{safe: true}).toArray(function(err, results) {
            if (err) cb(err);
            else {
              cb(null, results);
            }
          });
        },
        function (results, cb) {
          if (!results) { cb(null,[]); return; }
          for (i=0;i<results.length;i++) {
            results[i] = { _id: results[i]._id,UserName: results[i].UserName,ProfilePic: results[i].ProfilePic,TagLine: results[i].TagLine,Name:results[i].Name,OnlineStatus: OnlineStatus(results[i].CookieString,results[i].LastCheck) }
          }
          cb(null, results);
        }
    ],
    function (err, results) {
        if (err) {
                cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};
//reset password
exports.resetpassword = function(username, cb) {
    async.waterfall([
        function (cb) {
          bcrypt.genSalt(3, function(err, salt) {
            var temppass = salt.substring(0,8);
            if (err) { cb(err); return; }
            db.users.findAndModify({ "UserName" :  { $regex: "^" + username.toLowerCase() + '$', $options: "-i" } },[],{ $set : { ResetPassword: temppass } },{new:true},function(err, results) {
              if (err) cb(err);
              else if (results == null) cb(6);
              else {
                cb(null, results.Email, results.ResetPassword);
              }
            });
          });
        }
    ],
    function (err, email, newpassword) {
        if (err) {
                cb(err); return;
        } else {
            cb(null, email, newpassword);
        }
    });
};
//update profile picture
exports.updatepicture = function(dbuser, newpic, cb) {
    async.waterfall([
        function (cb) {
          var base64Image = new Buffer(newpic, 'binary').toString('base64');
          db.users.update({ "_id" : dbuser._id },{ $set : { ProfilePic : base64Image } },{safe:true},function(err,result) {
            if (err) cb(err);
            else cb(null, base64Image);
          });
        }
    ],
    function (err, results) {
        if (err) {
            cb(err);
        } else {
            cb(err, err ? null : results);
        }
    });
};
