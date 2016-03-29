var express = require('express');
var app = express();
var bodyParser = require('body-parser');
//var busboy = require('connect-busboy');
var db = require('./data/db.js'),
    chat_hdlr = require('./handlers/rtchat.js'),
    error_hdlr = require('./handlers/helpers.js'),
    mailer = require('express-mailer'),
    im = require('imagemagick'),
    fs = require('fs');

app.use(express.static(__dirname + "/static"));

app.use(bodyParser.json({ limit: '50mb'}));
app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));
//app.use(busboy());

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.post('/Register', chat_hdlr.Register);
app.post('/Login', chat_hdlr.Login);
app.post('/CheckUserName', chat_hdlr.CheckUserName);
app.post('/SearchUsers', chat_hdlr.SearchUsers);
app.post('/OpenNewChat', chat_hdlr.OpenNewChat);
app.post('/Relogin', chat_hdlr.Relogin);
app.post('/Logout', chat_hdlr.Logout);
app.post('/LeaveChat', chat_hdlr.LeaveChat);
app.post('/GetFriendInfo', chat_hdlr.GetFriendInfo);
app.post('/SendInvite', chat_hdlr.SendInvite);
app.post('/UpdateProfile', chat_hdlr.UpdateProfile);
app.post('/BlockUser', chat_hdlr.BlockUser);
app.post('/AddFriend', chat_hdlr.AddFriend);
app.post('/Unblock', chat_hdlr.Unblock);
app.post('/UnFriend', chat_hdlr.UnFriend);
app.post('/ChangePassword', chat_hdlr.ChangePassword);
app.post('/AcceptInvite', chat_hdlr.AcceptInvite);
app.post('/DeclineInvite', chat_hdlr.DeclineInvite);
app.post('/GuestLogin', chat_hdlr.GuestLogin);
app.post('/SendAndReceive', chat_hdlr.SendAndReceive);
app.post('/ReloadFriends', chat_hdlr.ReloadFriends);
app.post('/ResetPassword', chat_hdlr.ResetPassword);
app.post('/UpdatePicture', chat_hdlr.UpdatePicture);

exports.squareImage = function(img, callback) {
      im.resize({
          srcData : fs.readFileSync(img, 'binary'),
          strip : false,
          width : 200,
          height : "200^",
          customArgs: [
               "-gravity", "center"
              ,"-extent", "200x200"
              ]
      }, function(err, stdout, stderr)
        {
          if (err){
              callback(stderr);
          } else {
            callback(null, stdout);
          }
        });
}
//app.route('/UpdatePicture').post(chat_hdlr.UpdatePicture);


app.post('*', four_oh_four);
app.get('*', four_oh_four);

function four_oh_four(req, res) {
    res.writeHead(404, { "Content-Type" : "application/json" });
    res.end(JSON.stringify(error_hdlr.invalid_resource()) + "\n");
}
mailer.extend(app, {
  from: 'andrewlouie60@gmail.com',
  host: 'smtp.gmail.com', // hostname
  secureConnection: true, // use SSL
  port: 465, // port for secure SMTP
  transportMethod: 'SMTP', // default is SMTP. Accepts anything that nodemailer accepts
  auth: {
    user: 'andrewlouie60@gmail.com',
    pass: 'fakepassword'
  }
});
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

exports.sendEmail = function(toemail, subject, OtherProperty, callback) {
  app.mailer.send('email', {
    to: toemail,
    subject: subject,
    OtherProperty: OtherProperty
  }, function (err) {
    if (err) callback(err)
    else callback(null, true);
  });
};

db.init(function (err, results) {
    if (err) {
        console.error("** FATAL ERROR ON STARTUP: ");
        console.error(err);
        process.exit(-1);
    }
//    db.chats.remove({},function(){});
//    db.users.remove({},function(){});

    app.listen(80,"205.189.214.201");
});
