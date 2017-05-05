var express = require('express');
var router = express.Router();
var ObjectId = require('mongodb').ObjectID;

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'asdsiJHKJHIWRqaasd8975';
/* GET home page. */
router.get('/', function(req, res, next) {
  res.send(200);
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

router.get('/login', function(req, res) { //REMEBER TO DO THINGS WITH THE changePass!
  var db = req.db;
  var collection = db.get('usercollection');
  collection.findOne({ loginId: req.query.id },{},function(e,docs){
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

router.get('/createUser', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin"){
    var db = req.db;
    var collection = db.get('usercollection');
    collection.insert({name: req.query.name, role: req.query.role, pass: encrypt(req.query.pass), changePass: true, loginId: req.query.loginId},function(e,docs){
      res.send("OK");
    });
  }
  else res.send(403)
});

router.get('/getUser', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('usercollection');
    collection.findOne({ _id: ObjectId(req.query.id) },{},function(e,docs){
      if(req.session.usr.role !== "admin") {
        delete docs.pass;
        delete docs.loginId;
        delete docs.changePass;
      }
      res.send(docs);
    });
  }
  else res.send(403)
});

router.get('/joinEvent', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.findOne({ _id: req.query.id },{},function(e,docs){
      if(JSON.parse(docs.participants).length < docs.max || docs.max == 0) {
        var save = JSON.parse(docs.participants);
        var fresh = true;
        save.forEach(function(entry){
          if(entry == req.query.usrId) {
            fresh = false;
          }
        })
        if(fresh) {
          var done = false;
          var usrCollection = db.get('usercollection');
          usrCollection.findOne({ _id: req.query.usrId },{},function(e,usrDocs){
            if(e) {
              res.send("That user doesn't exist or the database is down")
            }
            if(docs.toEVI == false || docs.toInnostaja == false) {
              if(docs.toEVI && usrDocs.role !== "EVI" && usrDocs.role !== "admin") {
                res.send("You're not invited!")
              }
              if(docs.toInnostaja && usrDocs.role !== "innostaja" && usrDocs.role !== "admin") {
                res.send("You're not invited!")
              }
            }
            else {
              save.push(req.query.usrId);
              if(usrDocs.role == "EVI") {
                collection.update({ _id: req.query.id }, {$set: { participants: JSON.stringify(save) }});
                done = true;
              }
              if(usrDocs.role == "innostaja" || usrDocs.role == "admin") {
                var jobs = JSON.parse(docs.jobs);
                jobs.forEach(function(job, index){
                  if(job.name == req.query.job) {
                    if(job.max > job.joined.length) {
                      var includes = false;
                      jobs.forEach(function(job2){
                        if(job2.joined.includes(req.query.usrId)) {
                          includes = true;
                        }
                      })
                      if(!includes) {
                        jobs[index].joined.push(req.query.usrId);
                        done = true;
                      }
                    }
                  }
                });
                collection.update({ _id: req.query.id }, {$set: { jobs: JSON.stringify(jobs) }});
              }
              if(typeof usrDocs.events !== 'undefined') {
                var eventCache = JSON.parse(usrDocs.events)
              }
              else {
                var eventCache = new Array;
              }
              if(done) {
                eventCache.push(req.query.id);
                usrCollection.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(eventCache) }});
                res.send("OK");
              }
              else res.send("That didn't save")
            }
          });
        }
        else {
          res.send("You have already joined!")
        }
      }
      else {
        res.send("This event is already full!")
      }
    });
  }
  else res.send(403)
});

router.get('/getEvents', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.find({}, function(e,docs){
      var temp = new Array;
      docs.forEach(function(val){
        if(req.session.usr.role == "EVI" && val.toEVI == "true") {
          temp.push(val);
        }
        else if (req.session.usr.role == "innostaja" && val.toInnostaja) {
          temp.push(val);
        }
        else if (req.session.usr.role == "admin") {
          temp.push(val);
        }
      })
      res.send(temp);
    });
  }
  else res.send(403)
});

router.get('/setEvent', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin"){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.insert({name: req.query.name, startTime: req.query.startTime, endTime: req.query.endTime, closes: req.query.closes, location: req.query.location, toInnostaja: req.query.toInnostaja, toEVI: req.query.toEVI, toIndividual: req.query.toIndividual, max: req.query.max, participants: JSON.stringify(new Array), jobs: req.query.jobs},function(e,docs){
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
