var db = require('./db.js'),
async = require('async'),
user_data = require('./users.js'),
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
//populate chat adds user info to the chat object from the user table
exports.populate = populate;
function populate(chat,callback) {
  async.waterfall([
    function(cb) {
      db.users.find({ _id: { $in : chat.UsersInChat } },{ UserName : 1, ProfilePic: 1 },{safe: true}).toArray(function(err, results) {
        if (err) cb(err);
        else {
          chat.UsersInChat = results;
          cb(null);
        }
      });
    },
    function (cb) {
      db.users.find({ _id: { $in : chat.InvitedUsers } },{ UserName: 1 }).toArray(function(err, results) {
        if (err) cb(err);
        else {
          chat.InvitedUsers = results;
          cb(null, chat);
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
//send an update to everyone else in the chat about changes
function ChatUpdate(chat, fromuserid, callback) {
  async.waterfall([
    //notify usersinchat
    function(cb) {
      (function iterator(i) {
        if (i < chat.UsersInChat.length) {
          var update = { ChatId: chat._id,isChatUpdate: true }
          if (chat.UsersInChat[i].toString() == fromuserid.toString()) iterator(i+1);
          else {
            db.users.update({ _id: chat.UsersInChat[i] },{ $push: { Updates: update } },{safe:true},function(err, results) {
              if (err) cb(err);
              else iterator(i+1);
            });
          }
        }
        else cb(null);
      })(0);
    },
    //notify invitedusers
    function(cb) {
      (function iterator2(i) {
        if (i < chat.InvitedUsers.length) {
          var update = { ChatId: chat._id,isChatUpdate: true }
          db.users.update({ _id: chat.InvitedUsers[i] },{ $push: { Updates: update } },{safe:true},function(err, results) {
            if (err) cb(err);
            else iterator2(i+1);
          });
        }
        else cb(null,true);
      })(0);
    }
  ],
  //return populatedchat
  function (err, results) {
      if (err) {
          callback(err);
      } else {
          callback(err, err ? null : results);
      }
  });
};
//open a new chat
exports.newchat = function (dbuser, adduser, callback) {
  var added = false;
  async.waterfall([
        // get the other user
        function (cb) {
          user_data.auth({ userid: adduser },function (err, result, otheruser) {
            if (err) cb (err);
            else if (otheruser == null) cb(3);
            else cb(null, otheruser);
          });
        },
        function(otheruser, cb) {
          var UsersInChat = [ dbuser._id ];
          var InvitedUsers = [];
          var newarray7 = [];
          for (i=0;i<otheruser.Friends.length;i++) {
            newarray7.push(otheruser.Friends[i].toString());
          }
          otheruser.Friends = newarray7;
          if (otheruser.AutoJoinChats && otheruser.Friends.indexOf(dbuser._id.toString()) > -1) {
            UsersInChat.push(otheruser._id);
            added = true;
          }
          else {
            InvitedUsers.push(otheruser._id);
          }
          var chat = { "UsersInChat" : UsersInChat, "InvitedUsers" : InvitedUsers };
          db.chats.insert(chat, { w: 1, safe: true }, function(err, inserted) {
            if (err) cb(err);
            else cb(null,otheruser, dbuser,inserted[0]);
          });
        },
        //populate chat and notify other users
        function(otheruser, dbuser, chat, cb) {
          ChatUpdate(chat, dbuser._id,function(err, results) {
            if (err) cb(err);
            else {
              populate(chat,function(err, populatedchat) {
                if (err) cb(err);
                else cb(null, populatedchat);
              });
            }
          });
        },
    ],
    function (err, results) {
        if (err) {
                callback(err);
        } else {
            callback(err, err ? null : results);
        }
    });
};

//leave chat
exports.leavechat = function (dbuser, chatid, callback) {
  async.waterfall([
        // get the chat
        function (cb) {
          var id = mongoObj(chatid);
          db.chats.find({ "_id" : id}).toArray(function(err, result) {
            if (err) cb(err);
            //make sure chat exists
            else if (result.length < 1) cb(4);
            //make sure user is in the chat
            else {
              //this bugs me.  the array is still storing storing mongo object id's that look exactly like strings so I have to put them back to a string array
              var newarray = [];
              for (i=0;i<result[0].UsersInChat.length;i++) {
                newarray.push(result[0].UsersInChat[i].toString());
              }
              result[0].UsersInChat = newarray;
              if (result[0].UsersInChat.indexOf(dbuser._id.toString()) == -1) cb(5);
              else cb(null,result[0]);
            }
          });
        },
        function(chat, cb) {
          //if there is only one person left in the chat and no invited users, chat is removed
          if (chat.UsersInChat.length < 2 || (chat.UsersInChat.length == 2 && chat.InvitedUsers.length == 0)) {
            chat.UsersInChat.splice(chat.UsersInChat.indexOf(dbuser._id.toString()),1);
            db.chats.remove({ _id: chat._id },{safe: true},function(err, result) {
              if (err) cb(err);
              else cb(null, chat);
            });
          }
          //otherwise, user is removed from the chat
          else {
            db.chats.findAndModify({ _id: chat._id},[],{ $pull: { UsersInChat : dbuser._id } }, { new: true }, function(err, updated) {
              if (err) cb(err);
              else cb(null, updated);
            });
          }
        },
        //remove any chat updates associated with that chat from the user object
        function (chat, cb) {
          db.users.update({ _id: dbuser._id},{ $pull : { Updates: { ChatId: chat._id } } },{safe:true},function(err,updated) {
            if (err) cb(err);
            else cb(null, chat);
          });
        },
        //notify other users
        function(chat, cb) {
          ChatUpdate(chat, 0, function(err) {
            if (err) cb(err);
            else cb(null, true);
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

//send invite
exports.sendinvite = function (dbuser, adduser, chatid, callback) {
  async.waterfall([
        // get the other user
        function (cb) {
          user_data.auth({ userid: adduser },function (err, result, otheruser) {
            if (err) cb (err);
            else if (otheruser == null) cb(3);
            else cb(null, otheruser);
          });
        },
        //get the chat
        function (otheruser, cb) {
          var id = mongoObj(chatid);
          db.chats.find({ "_id" : id}).toArray(function(err, result) {
            if (err) cb(err);
            //make sure chat exists
            else if (result.length < 1) cb(4);
            //make sure user is in the chat
            else {
              //this bugs me.  the array is still storing storing mongo object id's that look exactly like strings so I have to put them back to a string array
              var newarray = [];
              for (i=0;i<result[0].UsersInChat.length;i++) {
                newarray.push(result[0].UsersInChat[i].toString());
              }
              result[0].UsersInChat = newarray;
              var newarray2 = [];
              for (i=0;i<result[0].InvitedUsers.length;i++) {
                newarray2.push(result[0].InvitedUsers[i].toString());
              }
              result[0].InvitedUsers = newarray2;
              if (result[0].UsersInChat.indexOf(dbuser._id.toString()) == -1) cb(10);
              else if (result[0].UsersInChat.indexOf(adduser) != -1) cb(11);
              else if (result[0].InvitedUsers.indexOf(adduser) != -1) cb(30);
              else cb(null,result[0],otheruser);
            }
          });
        },
        function(chat, otheruser, cb) {
          //here I need to check if the user is blocking me and if they have me as a friend and are autoaccepting chats.  need arrays with strings to do an indexOf again
          var newarray3 = [];
          for (i=0;i<otheruser.BlockedUsers.length;i++) {
            newarray3.push(otheruser.BlockedUsers[i].toString());
          }
          otheruser.BlockedUsers = newarray3;
          var newarray4 = [];
          for (i=0;i<otheruser.Friends.length;i++) {
            newarray4.push(otheruser.Friends[i].toString());
          }
          otheruser.Friends = newarray4;
          //check for if the other user is blocking you
          if (otheruser.BlockedUsers.indexOf(dbuser._id.toString()) != -1) {
            cb(12);
            return;
          }
          //add them to the chat
          else if (otheruser.AutoJoinChats  && otheruser.Friends.indexOf(dbuser._id.toString()) != -1) {
            db.chats.findAndModify({_id: chat._id},[],{ $push: { UsersInChat : otheruser._id } },{new: true }, function(err, updated) {
              if (err) cb(err);
              else cb(null, updated);
            });
          }
          else {
            db.chats.findAndModify({ _id: chat._id},[],{ $push: { InvitedUsers: otheruser._id } }, { new: true }, function(err, updated) {
              if (err) cb(err);
              else cb(null, updated);
            });
          }
        },
        //notify other users
        function(chat, cb) {
          ChatUpdate(chat, dbuser._id, function(err) {
            if (err) cb(err);
            else {
              populate(chat,function(err, populatedchat) {
                if (err) cb(err);
                else cb(null, populatedchat);
              });
            }
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

//accept invite
exports.acceptinvite = function (dbuser, chatid, callback) {
  async.waterfall([
        //get the chat
        function (cb) {
          var id = mongoObj(chatid);
          db.chats.find({ "_id" : id}).toArray(function(err, result) {
            if (err) cb(err);
            //make sure chat exists
            else if (result.length < 1) cb(4);
            //make sure you're not in the chat and you're invited
            else {
              //this bugs me.  the array is still storing storing mongo object id's that look exactly like strings so I have to put them back to a string array
              var newarray = [];
              for (i=0;i<result[0].UsersInChat.length;i++) {
                newarray.push(result[0].UsersInChat[i].toString());
              }
              result[0].UsersInChat = newarray;
              var newarray2 = [];
              for (i=0;i<result[0].InvitedUsers.length;i++) {
                newarray2.push(result[0].InvitedUsers[i].toString());
              }
              result[0].InvitedUsers = newarray2;
              if (result[0].UsersInChat.indexOf(dbuser._id.toString()) != -1) cb(13);
              else if (result[0].InvitedUsers.indexOf(dbuser._id.toString()) == -1) cb(14);
              else cb(null,result[0]);
            }
          });
        },
        function(chat, cb) {
          db.chats.findAndModify({ _id: chat._id },[],{ $push: { UsersInChat: dbuser._id }, $pull: { InvitedUsers: dbuser._id } }, { new:true }, function(err, updated) {
            if (err) cb(err);
            else cb(null, updated);
          });
        },
        //notify other users
        function(chat, cb) {
          ChatUpdate(chat, dbuser._id, function(err) {
            if (err) cb(err);
            else {
                populate(chat,function(err, populatedchat) {
                  if (err) cb(err);
                  else cb(null, populatedchat);
                });
              }
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

//accept invite
exports.declineinvite = function (dbuser, chatid, callback) {
  async.waterfall([
        //get the chat
        function (cb) {
          var id = mongoObj(chatid);
          db.chats.find({ "_id" : id}).toArray(function(err, result) {
            if (err) cb(err);
            //make sure chat exists
            else if (result.length < 1) cb(4);
            //make sure you're not in the chat and you're invited
            else {
              //this bugs me.  the array is still storing storing mongo object id's that look exactly like strings so I have to put them back to a string array
              var newarray = [];
              for (i=0;i<result[0].UsersInChat.length;i++) {
                newarray.push(result[0].UsersInChat[i].toString());
              }
              result[0].UsersInChat = newarray;
              var newarray2 = [];
              for (i=0;i<result[0].InvitedUsers.length;i++) {
                newarray2.push(result[0].InvitedUsers[i].toString());
              }
              result[0].InvitedUsers = newarray2;
              if (result[0].UsersInChat.indexOf(dbuser._id.toString()) != -1) cb(13);
              else if (result[0].InvitedUsers.indexOf(dbuser._id.toString()) == -1) cb(14);
              else cb(null,result[0]);
            }
          });
        },
        function(chat, cb) {
          db.chats.findAndModify({ _id: chat._id },[],{ $pull: { InvitedUsers: dbuser._id } }, { new: true }, function(err, updated) {
            if (err) cb(err);
            else cb(null, updated);
          });
        },
        //notify other users
        function(chat, cb) {
          ChatUpdate(chat, dbuser._id, function(err) {
            if (err) cb(err);
            else cb(null, true);
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

//send messages
exports.send = function (dbuser, messages, callback) {
  async.waterfall([
        //get the chat
        function (cb) {
          (function iterator3(i) {
            if (i < Object.keys(messages).length) {
              var id = mongoObj(Object.keys(messages)[i]);
              var stringid = Object.keys(messages)[i];
              db.chats.find({ "_id" : id}).toArray(function(err, result) {
                if (err) cb(err);
                //make sure chat exists
                else if (result.length < 1) cb(4);
                //make sure you're in the chat
                else {
                  //this bugs me.  the array is still storing mongo object id's that look exactly like strings so I have to put them back to a string array
                  var newarray = [];
                  for (i=0;i<result[0].UsersInChat.length;i++) {
                    newarray.push(result[0].UsersInChat[i].toString());
                  }
                  var chat = result[0];
                  if (newarray.indexOf(dbuser._id.toString()) == -1) cb(5);
                  else {
                    //this is getting insanely complicated, sorry
                    (function iterator4(j) {
                      if (j < chat.UsersInChat.length) {
                        if (chat.UsersInChat[j].toString() == dbuser._id.toString()) iterator4(j+1);
                        else {
                          var limitmsg = (messages[stringid].length > 3000 ? messages[stringid].substring(messages[stringid].length-3000) : messages[stringid]);
                          db.users.update({ _id: chat.UsersInChat[j],"Updates.ChatId":chat._id },{ $set: { "Updates.$.Message": limitmsg,"Updates.$.Updated": new Date() } },{safe:true},function(err, results) {
                            //I was hoping this would  add the element if it's not found.  guess not
                            if (err) cb(err);
                            else if (results == 0) {
                              newupdate = { ChatId: chat._id,Message:limitmsg,Updated: new Date(),FromUser: dbuser._id };
                              db.users.update({ _id : chat.UsersInChat[j] },{ $push: { Updates: newupdate } },function(err, results) {
                                iterator4(j+1);
                              })
                            }
                            else iterator4(j+1);
                          });
                        }
                      }
                      else iterator3(i+1);
                    })(0);
                  }
                }
              });
            }
            else cb(null);
          })(0);
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
