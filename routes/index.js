var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'asdsiJHKJHIWRqaasd8975';
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/info', function(req, res) {
  res.send(req.session);
});

function encrypt(text){
  var cipher = crypto.createCipher(algorithm,password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}

router.get('/login', function(req, res) {
  var db = req.db;
  var collection = db.get('usercollection');
  collection.findOne({ _id: ObjectId(req.query.id) },{},function(e,docs){
      console.log(docs)
      console.log("AKLSJD")
      if(encrypt(req.query.pass) == docs.pass) {
        res.status(200);
        req.session.loggedIn = true;
        req.session.usr = docs;
      }
      else {
        res.status(430);
        req.session.loggedIn = false;
      }
      res.send(req.session);
  });
});

router.get('/logout', function(req, res) {
  req.session.loggedIn = false;
  res.send(200);
});

router.get('/getEvents', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.find({}, function(e,docs){
      var temp = new Array;
      docs.forEach(function(val){
        console.log(val.toEVI + " " + req.session.usr.role);
        if(req.session.usr.role == "EVI" && val.toEVI == "true") {
          temp.push(val);
          console.log("EVI")
        }
        else if (req.session.usr.role == "innostaja" && val.toInnostaja) {
          temp.push(val);
          console.log("innostaja")
        }
        else if (req.session.usr.role == "admin") {
          temp.push(val);
          console.log("admin")
        }
      })
      res.send(temp);
    });
  }
  else res.send(403)
});

router.get('/setEvent', function(req, res) {
  console.log(req.session)
  if(req.session.loggedIn && req.session.usr.role == "admin"){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.insert({name: req.query.name, startTime: req.query.startTime, endTime: req.query.endTime, closes: req.query.closes, location: req.query.location, toInnostaja: req.query.toInnostaja, toEVI: req.query.toEVI, toIndividual: req.query.toIndividual, max: req.query.max},function(e,docs){
        res.send("OK");
    });
  }
  else res.send(403)
});

router.get('/getEvent', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.find({ _id: req.query.id },{},function(e,docs){
        res.send(docs);
    });
  }
  else res.send(403)
});

module.exports = router;
