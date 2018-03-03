var express = require('express');
var path = require('path');
var fs = require("fs");
//var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

const swaggerUi = require('swagger-ui-express'); //SwaggerUI middleware load
const swaggerDocument = require('./prophet-api_v0.1.0.json');

var monk = require('monk');
var db = monk('DEVELOPMENT:DEVELOPMENT@localhost:27017/prophet'); //Mongo password is changed here!

//routes
var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

function readJsonFileSync(filepath, encoding){
    if (typeof (encoding) == 'undefined'){
        encoding = 'utf8';
    }
    var file = fs.readFileSync(filepath, encoding);
    return JSON.parse(file);
}

function getApikeys() {
    var filepath = __dirname + '/' + "apikeys.json";
    return readJsonFileSync(filepath);
}

app.use(session({
  secret: 'dfagqwqwsd5f87asd<aslkfjlsasd545',
  resave: false,
  saveUninitialized: true,
}))

app.use(function(req, res, next) { //CORS support
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Expose-Headers', 'Content-Length');
  res.header('Access-Control-Allow-Headers', 'Accept, Authorization, connect.sid, Content-Type, X-Requested-With, Range');
  if (req.method === 'OPTIONS') {
    return res.send(200);
  } else {
    return next();
  }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// set database to requests
app.use(function(req,res,next){
  req.db = db;
  next();
});

app.all('*', function(req, res, next) {
  if(process.env.NODE_ENV == "dev") {
    getApikeys().forEach(function(apiuser, index){
      if(apiuser.apikey == req.query.apikey) {
        req.session.loggedIn = true;
        req.session.usr = apiuser.data;
      }
      if(index + 1 == getApikeys().length) next();
    })
  } else {
    next();
  }
})

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
