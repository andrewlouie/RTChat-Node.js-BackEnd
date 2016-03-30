var helpers = require('./helpers.js'),
    async = require('async'),
    user_data = require('../data/users.js'),
    chats_data = require('../data/chats.js'),
    main = require('../index.js'),
    fs = require('fs');

exports.Register = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.  Other validation is done by user_data.create_user
          if (!req.body || !req.body.name || !req.body.email || !req.body.username || !req.body.password) {
              cb(35);
              return;
          }
          cb(null);
      },
      function (cb) {
          //validate info and create user
          try {
             user_data.create_user(req.body, cb);
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Profile : helpers.striped_user(results),Id : results._id, CookieString : results.CookieString,isGuest:false });
      }
  });
};

exports.Login = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted
          if (!req.body || !req.body.password || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      function (cb) {
          //validate info and login
          try {
             user_data.login(req.body, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Profile: helpers.striped_user(results),Id: results._id,CookieString: results.CookieString,isGuest:false });
      }
  });
};

exports.SearchUsers = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //search for users
      function (cb) {
          try {
             user_data.search(req.body.username, function(err, results, count) {
               if (err) cb(err);
               else cb(null, results, count);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results,count) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Results : results,Count : count });
      }
  });
};

exports.CheckUserName = function(req,res) {
  async.waterfall([
      // validate info
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      //search for users
      function (cb) {
          try {
             user_data.searchexact(req.body.username, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { InUse:results });
      }
  });
};

exports.OpenNewChat = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.adduser) {
              cb(35);
              return;
          }
          if (req.body.userid == req.body.adduser) cb(2);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //open new chat
      function (dbuser, cb) {
          try {
             chats_data.newchat(dbuser, req.body.adduser, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Chat : results });
      }
  });
};

exports.Relogin = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted
          if (!req.body || !req.body.cookie || !req.body.userid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //relogin
      function (dbuser, cb) {
        user_data.relogin(dbuser,function (err, loggedinuser) {
          if (err) cb(err);
          else cb(null, loggedinuser);
        });
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Profile: helpers.striped_user(results),Id: results._id,CookieString: results.CookieString,isGuest :results.isGuest });
      }
  });
};

exports.Logout = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted
          if (!req.body || !req.body.cookie || !req.body.userid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //logout
      function (dbuser, cb) {
        user_data.logout(dbuser,function (err, result) {
          if (err) cb(err);
          else cb(null, result);
        });
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success: results });
      }
  });
};

exports.LeaveChat = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.chatid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //leave chat
      function (dbuser, cb) {
          try {
             chats_data.leavechat(dbuser, req.body.chatid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success: results });
      }
  });
};

exports.GetFriendInfo = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.friendid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //get friend info
      function (cb) {
          try {
             user_data.friendinfo(req.body.friendid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Friend : results });
      }
  });
};

exports.SendInvite = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.adduser || !req.body.chatid) {
              cb(35);
              return;
          }
          if (req.body.adduser == req.body.userid) cb(2);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //send invite
      function (dbuser, cb) {
          try {
             chats_data.sendinvite(dbuser, req.body.adduser, req.body.chatid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Chat : results });
      }
  });
};

exports.UpdateProfile = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.name || !req.body.email || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(20);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //do update & validation
      function (dbuser, cb) {
          try {
             user_data.updateprofile(dbuser, req.body, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};

exports.BlockUser = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.blockuserid) {
              cb(35);
              return;
          }
          if (req.body.userid == req.body.otheruserid) cb(37);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(15);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //block user
      function (dbuser, cb) {
          try {
             user_data.blockuser(dbuser, req.body.blockuserid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};
exports.AddFriend = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.otheruserid) {
              cb(35);
              return;
          }
          if (req.body.userid == req.body.otheruserid) cb(27);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(21);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //add friend
      function (dbuser, cb) {
          try {
             user_data.addfriend(dbuser, req.body.otheruserid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Friend : results });
      }
  });
};
exports.Unblock = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.blockeduser) {
              cb(35);
              return;
          }
          if (req.body.userid == req.body.blockeduser) cb(37);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(16);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //unblock
      function (dbuser, cb) {
          try {
             user_data.unblock(dbuser, req.body.blockeduser, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};
exports.UnFriend = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.otheruserid) {
              cb(35);
              return;
          }
          if (req.body.userid == req.body.otheruserid) cb(37);
          else cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(21);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //unblock
      function (dbuser, cb) {
          try {
             user_data.unfriend(dbuser, req.body.otheruserid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};

exports.ChangePassword = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.oldpassword || !req.body.newpassword) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else if (dbuser.isGuest) cb(17);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //do update & validation
      function (dbuser, cb) {
          try {
             user_data.updatepassword(dbuser, req.body, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};

exports.AcceptInvite = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.chatid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //accept invite
      function (dbuser, cb) {
          try {
             chats_data.acceptinvite(dbuser, req.body.chatid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Chat : results });
      }
  });
};

exports.DeclineInvite = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.chatid) {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      //accept invite
      function (dbuser, cb) {
          try {
             chats_data.declineinvite(dbuser, req.body.chatid, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
        if (err.message) helpers.send_error(res,err.message);
        else helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};

exports.GuestLogin = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.  Other validation is done by user_data.create_user
          if (!req.body || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      function (cb) {
          //validate info and create user
          try {
             user_data.guestlogin(req.body.username, function(err, results) {
               if (err) cb(err);
               else cb(null,results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { UserName: results.UserName,Profile : helpers.striped_user(results),Id : results._id, CookieString : results.CookieString,isGuest :true });
      }
  });
};

exports.SendAndReceive = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.  Other validation is done by user_data.create_user
          if (!req.body || !req.body.cookie || !req.body.userid || !req.body.messages || typeof req.body.messages != 'object') {
              cb(35);
              return;
          }
          cb(null);
      },
      //authorization
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      function (dbuser, cb) {
          //send messages
          if (Object.keys(req.body.messages).length) {
            try {
               chats_data.send(dbuser, req.body.messages, function(err, results) {
                 if (err) cb(err);
                 else cb(null, dbuser);
               });
             }
             catch(e) {
               cb(e);
               return;
             }
         }
         else cb(null, dbuser);
      },
      function (dbuser, cb) {
          //remove chat updates and update lastcheck
          try {
             user_data.receive(dbuser, function(err, results) {
               if (err) cb(err);
               else cb(null,dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Updates: helpers.filter(results) });
      }
  });
};

exports.ReloadFriends = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.  Other validation is done by user_data.create_user
          if (!req.body || !req.body.cookie || !req.body.userid) {
              cb(35);
              return;
          }
          cb(null);
      },
      function (cb) {
          try {
             user_data.auth(req.body, function(err, result, dbuser) {
               if (err) cb(err);
               else if (!result) cb(1);
               else cb(null, dbuser);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      function (dbuser, cb) {
          try {
             user_data.getfriends(dbuser, function(err, results) {
               if (err) cb(err);
               else cb(null, results);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Friends: results });
      }
  });
};

exports.ResetPassword = function(req,res) {
  async.waterfall([
      function (cb) {
        //make sure all the fields are submitted.  Other validation is done by user_data.create_user
          if (!req.body || !req.body.username) {
              cb(35);
              return;
          }
          cb(null);
      },
      function (cb) {
          //validate info and create user
          try {
             user_data.resetpassword(req.body.username, function(err, email, newpassword) {
               if (err) cb(err);
               else cb(null, email, newpassword);
             });
           }
           catch(e) {
             cb(e);
             return;
           }
      },
      function (email, newpassword, cb) {
        main.sendEmail(email,"RTChat Password Reset",newpassword, function(err, results) {
          if(err) cb(err);
          else cb(null, results);
        })
      }
  ],
  function (err, results) {
      if (err) {
          helpers.send_error(res, err);
      } else {
          helpers.send_success(res, { Success : results });
      }
  });
};

exports.UpdatePicture = function (req, res) {
//  req.pipe(req.busboy);
  //receive first two fields and set variables for later authorization
  //should probably fix this to check fieldname
  //fields need to be first in the form
/*  req.busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
    if (!cookiestring) { cookiestring = val; return; }
    else {
      userid = val;
    }
  });
  */
  //receive file next, write to temp.jpg (even if it isn't a jpg it doesn't matter)
  /*req.busboy.on('file', function (fieldname, file, filename) {
    fstream = fs.createWriteStream(__dirname + '/../' + "temp.jpg");
    file.pipe(fstream);
    fstream.on('close', function () {
        //finished writing, check authorization.  should probably also check filesize/type before receiving it all but whatever
        */
        async.waterfall([
            function (cb) {
                //make sure all the fields are submitted.  Other validation is done by user_data.create_user
                if (!req.body || !req.body.cookie || !req.body.userid || !req.body.file) {
                    cb(35);
                    return;
                }
                cb(null);
            },
            //authorization
            function (cb) {
                try {
                   user_data.auth(req.body, function(err, result, dbuser) {
                     if (err) cb(err);
                     else if (!result) cb(1);
                     else if (dbuser.isGuest) cb(20);
                     else cb(null, dbuser);
                   });
                 }
                 catch(e) {
                   cb(e);
                   return;
                 }
            },
            //set profile picture.  I write it to a file, square it and get it back again.  There is probably a better way
            function (dbuser, cb) {
              require("fs").writeFile("temp.jpg", req.body.file, 'base64', function(err) {
                if (err) { cb(33); return; }
                main.squareImage("temp.jpg",function(err, result) {
                  if (err) cb(33);
                  else {
                    user_data.updatepicture(dbuser, result, function(err, result) {
                      if (err) cb(err);
                      else cb(null, result);
                    });
                  };
                });
              });

            }
        ],
        function (err, results) {
            if (err) {
                helpers.send_error(res, err);
            } else {
                helpers.send_success(res, { Picture : results });
            }
        });
}
