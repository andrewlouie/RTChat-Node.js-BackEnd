exports.error = function (code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
};
//really bad errors, database problems
exports.invalid_resource = function () {
    return exports.error("invalid_resource",
                         "The requested resource does not exist.");
};
//successful
exports.send_success = function(res, data) {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(data));
}
//used for regular errors
exports.send_error = function(res, data) {
    res.writeHead(200, {"Content-Type": "application/json"});
    var output = { Error: data };
    res.end(JSON.stringify(output));
}
//return only the necessary parts
exports.striped_user = function(user) {
  if (!user.Chats) user.Chats = [];
  return { Name : user.Name, TagLine : user.TagLine, Email : user.Email, AutoJoinChats : user.AutoJoinChats, Username : user.UserName, ProfilePic : user.ProfilePic,Chats : user.Chats,Friends : user.Friends,Updates: user.Updates,BlockedUsers: user.BlockedUsers  }
}

exports.filter = function(dbuser) {
  var newarraytest = [];
  for (i=0;i<dbuser.Updates.length;i++) {
    if (dbuser.Updates[i].isChatUpdate) newarraytest.push({ Chat: dbuser.Updates[i].Chat,isChatUpdate:dbuser.Updates[i].isChatUpdate});
    if (dbuser.LastCheck < dbuser.Updates[i].Updated) newarraytest.push({ ChatId: dbuser.Updates[i].ChatId,FromUser: dbuser.Updates[i].FromUser,Message: dbuser.Updates[i].Message})
  }
  return newarraytest;
}
