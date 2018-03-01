var express = require('express');
var ObjectId = require('mongodb').ObjectID;
var _ = require('lodash')
var bcrypt = require('bcrypt');
var router = express.Router();

const saltRounds = 10;

var crypto = require('crypto'),
    algorithm = 'aes-256-ctr',
    password = 'asdsiJHKJHIWRqaasd8975';

//generates 8-char long random string
function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
  for (var i = 0; i < 8; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  
  return text;
}
function encrypt(text){
  var cipher = crypto.createCipher(algorithm,password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
    
/* GET home page. */
router.get('/', function(req, res, next) {
  res.send(200);
});

router.get('/info', function(req, res) {
  if(req.session.loggedIn) {
    var db = req.db;
    var collection = db.get('usercollection');
    collection.findOne({ _id: req.session.usr._id },{},function(e,docs) {
      if(docs._id == req.session.usr._id) {
        req.session.usr = docs;
        res.send(req.session);
      }
      else res.send(null)
    });
  }
  else res.send(req.session);
});

router.get('/login', function(req, res) {
  var db = req.db;
  var collection = db.get('usercollection');
  if(req.query.changePass == "true") {
    bcrypt.compare(req.query.oldPass, req.session.usr.pass, function(err, cor) {
      if(cor) {
        bcrypt.hash(req.query.newPass, saltRounds, function(err, hash) {
          if(err) res.send("There was an error while hashing: " + err);
          else {
              collection.update({ _id: req.session.usr._id }, {$set: { pass: hash, changePass: false }});
              req.session.usr.changePass = false;
              res.send(req.session);
          }
        });
      }
      else res.send(403);
    });
  }
  else {
  collection.findOne({ loginId: req.query.id },{},function(e,docs){
    if(e) {
      res.send(e);
    }
    bcrypt.compare(req.query.pass, docs.pass, function(err, cor) {
      if(cor) {
        res.status(200);
        req.session.loggedIn = true;
        req.session.usr = docs;
      }
      else {
        res.status(403);
        req.session.loggedIn = false;
      }
      res.send(req.session);
    });
  });
}
});

router.get('/logout', function(req, res) {
  req.session.loggedIn = false;
  res.send(200);
});

router.get('/createUser', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin") {
    var db = req.db;
    var collection = db.get('usercollection');
    bcrypt.hash(req.query.pass, saltRounds, function(err, hash) {
      if(err) res.send("There was an error while hashing: " + err);
      else {
        collection.insert({
            name: req.query.name, 
            role: req.query.role, 
            pass: hash, 
            changePass: true, 
            eventRequirements: req.query.eventRequirements,
            loginId: req.query.loginId, 
            verifiedEvents: JSON.stringify(new Array), 
            events: JSON.stringify(new Array), 
            reservedEvents: JSON.stringify(new Array)
          },
          function(e,docs){
            res.send("OK");
          }
        );
      }
    });
  }
  else res.send(403);
});

router.get('/generateGroup', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin") {
    console.log(req.query);
    var db = req.db;
    var collection = db.get('usercollection');
    req.query.names = JSON.parse(req.query.names);
    var profileCache = new Array();
    req.query.names.forEach(function(name, index){
      var pass = makeid();
      var settings = db.get("globalsettings")
      settings.findOne({}, function(e,docs2){
        if(e) console.log(e)
        var eventRequirements = docs2.settings.eventRequirements[req.query.role]
        bcrypt.hash(pass, saltRounds, function(err, hash) {
          if(err) res.send("There was an error while hashing: " + err);
          else {
            collection.insert({
                name: name, 
                role: req.query.role, 
                groupId: req.query.groupName, 
                pass: hash, changePass: true, 
                eventRequirements: eventRequirements, 
                loginId: name.replace(" ", "."), 
                verifiedEvents: JSON.stringify(new Array), 
                events: JSON.stringify(new Array), 
                reservedEvents: JSON.stringify(new Array)
              },
              function(e,docs){
                profileCache.push({
                  name: name, 
                  pass: pass, 
                  loginId: name.replace(" ", ".")
                });
                if(profileCache.length == req.query.names.length) 
                  res.send(JSON.stringify(profileCache));
              }
            );
          }
        });
      })
    })
  }
});

router.get('/deleteUser', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin" && req.query != "") {
    var db = req.db;
    var collection = db.get('usercollection');
    collection.remove({_id: ObjectId(req.query.id)}, {}, function(e, docs){
      res.send("OK");
    });
  }
  else res.send(403)
});

router.get('/deleteParticipant', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin" 
    || req.session.usr._id == req.query.usrId && req.query != "") {
    var db = req.db;
    var collection = db.get('eventcollection');
    var usrCollection = db.get('usercollection');
    collection.findOne({_id: ObjectId(req.query.id)}, {}, function(e, docs){
      var docsCache = docs;
      if(e) console.log(e);
      else {
        usrCollection.findOne({ _id: req.query.usrId },{},function(e,removedUserData){
          if(e) {
            console.log(e);
            res.send("That user doesn't exist or the database is down");
          }
          var removeUserEvents = JSON.parse(removedUserData.events);
          var index3 = removeUserEvents.indexOf(req.query.id);
          removeUserEvents.splice(index3, 1);
          var index = JSON.parse(docsCache.participants).indexOf(req.query.usrId);
          docsCache = JSON.parse(docsCache.participants);
          reservedParticipantsCache = JSON.parse(docs.reservedParticipants);
          docsCache.splice(index,1);
          if(reservedParticipantsCache.length > 0) {
            usrCollection.findOne({ _id: reservedParticipantsCache[0] },{},function(e,usrDocs){
              if(e) {
                console.log(e);
                res.send("That user doesn't exist or the database is down");
              }
              console.log(usrDocs);
              docsCache.push(usrDocs._id);
              var reservedEventsCache = JSON.parse(usrDocs.reservedEvents);
              var index2 = reservedEventsCache.indexOf(req.query.id);
              reservedEventsCache.splice(index2, 1);
              var eventsCache = JSON.parse(usrDocs.events);
              eventsCache.push(req.query.id);
              console.log(reservedParticipantsCache.splice(0,1));
              collection.update({ _id: req.query.id }, {$set: { participants: JSON.stringify(docsCache) }});
              collection.update({ _id: req.query.id }, {$set: { reservedParticipants: JSON.stringify(reservedParticipantsCache.splice(0,1)) }});
              usrCollection.update({ _id: usrDocs._id }, {$set: { reservedEvents: JSON.stringify(reservedEventsCache) }});
              usrCollection.update({ _id: usrDocs._id }, {$set: { events: JSON.stringify(eventsCache) }});
              usrCollection.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(removeUserEvents) }});
              res.send("removed using reserve");
            });
          }
          else {
            collection.update({ _id: req.query.id }, {$set: { participants: JSON.stringify(docsCache) }});
            usrCollection.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(removeUserEvents) }});
            res.send("removed without reserve");
          }
      });
      }
    });
  }
  else res.send(403)
});

router.get('/getUser', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('usercollection');
    collection.findOne({ _id: ObjectId(req.query.id) },{},function(e,docs){
      delete docs.pass;
      if(req.session.usr.role !== "admin") {
        delete docs.loginId;
        delete docs.changePass;
        delete docs.events;
      }
      res.status(200).send(docs);
    });
  }
  else res.send(403);
});

router.get('/getUsers', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin"){
    var db = req.db;
    var collection = db.get('usercollection');
    collection.find({},{},function(e,docs){
      docs.forEach(function(object, index){
        delete docs[index].pass;
      })
      res.status(200).send(docs);
    });
  }
  else res.send(403);
});

router.get('/verifyEvent', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin" && req.query != ""){
    var db = req.db;
    var collection = db.get('eventcollection');
      collection.findOne({_id: req.query.id}, {}, function(e, docs){
        collection2 = db.get('usercollection');
        collection2.findOne({ _id: req.query.usrId },{},function(e,usrDocs){
          var verifiedCache = JSON.parse(usrDocs.verifiedEvents);
          verifiedCache.push({event: req.query.id, verifier: req.session.usr._id});
          var eventCache = JSON.parse(usrDocs.events);
          eventCache = eventCache.map(function(val){
            if(val !== req.query.id) return val
          })
          console.log(usrDocs.verifiedEvents);
          eventCache = _.compact(eventCache);
          collection2.update({ _id: req.query.usrId }, {$set: { verifiedEvents: JSON.stringify(verifiedCache) }});
          collection2.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(eventCache) }});
          res.send("OK");
        });
      });
  }
  else res.send(403);
});

router.get('/joinEvent', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.findOne({ _id: req.query.id },{},function(e,docs){
      var save = JSON.parse(docs.participants);
      var fresh = true;
      save.forEach(function(entry){
        if(entry == req.query.usrId) {
          fresh = false;
        }
      })
      if(fresh) {
        if(JSON.parse(docs.participants).length < docs.max || docs.max == 0) {
          var done = false;
          var usrCollection = db.get('usercollection');
          usrCollection.findOne({ _id: req.query.usrId },{},function(e,usrDocs){
            if(e) {
              res.send("That user doesn't exist or the database is down")
            }
            if(docs.toEVI == false || docs.toInnostaja == false) {
              if(docs.toEVI && usrDocs.role !== "EVI" && usrDocs.role !== "admin") {
                res.send("You're not invited!");
              }
              if(docs.toInnostaja && usrDocs.role !== "innostaja" && usrDocs.role !== "admin") {
                res.send("You're not invited!");
              }
            }
            else {
              save.push(req.query.usrId);
              if(usrDocs.role == "EVI") {
                collection.update({ _id: req.query.id }, {$set: { participants: JSON.stringify(save) }});
                done = true;
                if(typeof usrDocs.events !== 'undefined') {
                  var eventCache = JSON.parse(usrDocs.events);
                }
                else {
                  var eventCache = new Array;
                }
                if(done) {
                  eventCache.push(req.query.id);
                  usrCollection.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(eventCache) }});
                  res.send("OK");
                }
                else res.send("That didn't save");
              }
              if(usrDocs.role == "innostaja" || usrDocs.role == "admin") {
                if(docs.jobs != null) {
                  var jobs = JSON.parse(docs.jobs);
                  jobs.forEach(function(job, index){
                    if(job.name == req.query.job) {
                      if(job.max > job.joined.length) {
                        var includes = false;
                        jobs.forEach(function(job2){
                          if(job2.joined.includes(req.query.usrId)) {
                            includes = true;
                          }
                        });
                        if(!includes) {
                          jobs[index].joined.push(req.query.usrId);
                          done = true;
                          if(typeof usrDocs.events !== 'undefined') {
                            var eventCache = JSON.parse(usrDocs.events);
                          }
                          else {
                            var eventCache = new Array;
                          }
                          if(done) {
                            eventCache.push(req.query.id);
                            usrCollection.update({ _id: req.query.usrId }, {$set: { events: JSON.stringify(eventCache) }});
                            res.send("OK");
                          }
                          else res.send("That didn't save");
                        }
                      }
                    }
                  });
                  collection.update({ _id: req.query.id }, {$set: { jobs: JSON.stringify(jobs) }});
                }
                else {
                  collection.update({ _id: req.query.id }, {$set: { participants: JSON.stringify(save) }});
                  done = true;
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
                  else res.send("That didn't save");
                }
              }
            }
          });
        }
        else {
          var save2 = JSON.parse(docs.reservedParticipants);
          var fresh2 = true;
          save2.forEach(function(entry){
            if(entry == req.query.usrId) {
              fresh2 = false;
            }
          });
          if(fresh2) {
            var reservedParticipantsCache = JSON.parse(docs.reservedParticipants);
            reservedParticipantsCache.push(req.query.usrId);
            var usrCollection = db.get('usercollection');
            usrCollection.findOne({ _id: req.query.usrId },{},function(e,usrDocs){
              if(e) {
                res.send("That user doesn't exist or the database is down");
              }
              reservedEventsCache = JSON.parse(usrDocs.reservedEvents);
              reservedEventsCache.push(req.query.id);
              collection.update({ _id: req.query.id }, {$set: { reservedParticipants: JSON.stringify(reservedParticipantsCache) }});
              usrCollection.update({ _id: req.query.usrId }, {$set: { reservedEvents: JSON.stringify(reservedEventsCache) }});
              res.send("You have reserved position!");
            });
          }
          else res.send("You have already joined!");
        }
      }
      else {
        res.send("You have already joined!");
      }
    });
  }
  else res.send(403);
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
        else if (req.session.usr.role == "innostaja" && val.toInnostaja == "true") {
          temp.push(val);
        }
        else if (req.session.usr.role == "admin") {
          temp.push(val);
        }
      });
      var controlDate = new Date();
      if(req.query.onlyJoinable == "true") {
        var joinableCache = new Array;
        temp.forEach(function(val, index){
          val.closes = new Date(val.closes.replace("GMT ", "GMT+"));
          if(val.closes > controlDate) {
            console.log(req.session.usr.events.includes(val._id));
            console.log(val._id);
            if(!req.session.usr.events.includes(val._id));
            {
              //if(JSON.parse(val.participants).length < val.max || val.max == 0) {
              joinableCache.push(val);
              //} 
            }
          }
        });
        temp = joinableCache;
      }
      res.send(temp);
    });
  }
  else res.send(403);
});

router.get('/searchEvents', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var collection = db.get('eventcollection');
    req.query.specific = JSON.parse(req.query.specific);
    collection.find({_id: { $in: req.query.specific.map(function (id) {return ObjectId(id);})}}, function(e,docs){
      if(e) console.log(e);
      res.send(docs);
    });
  }
})

router.get('/dbSearch', function(req, res) {
  if(req.session.loggedIn){
    var groupCache = new Array();
    var response = new Array();
    var db = req.db;
    var data = false;
    var eventcollection = db.get('eventcollection');
    var usercollection = db.get('usercollection');
    eventcollection.find({}, function(e,eventdocs){
      eventdocs = eventdocs.map(function(val){
        if(_.lowerCase(val.name).includes(_.lowerCase(req.query.term))) return val;
      });
      usercollection.find({}, function(e,userdocs){
        userdocs = userdocs.map(function(val){
          if(_.lowerCase(val.name).includes(_.lowerCase(req.query.term)) || _.lowerCase(val.role).includes(_.lowerCase(req.query.term))) return val
        });
        userdocs = _.compact(userdocs);
        eventdocs = _.compact(eventdocs);
        usercollection.find({}, function(e,groupArray){
          groupArray.forEach(function(user, index){
            if(_.lowerCase(user.groupId).includes(_.lowerCase(req.query.term))) {
              groupCache.push(user);
            }
            if(index + 1 == groupArray.length) {
              if(groupCache.length > 0 && req.session.usr.role == "admin") {
                if(!req.query.onlyMeta == "true") {
                  groupCache.push(groupCache[0].groupId);
                  if(response.length == 0) response=groupCache;
                  else response.concat(groupCache);
                }
                else {
                  if(response.length == 0) 
                    response = [{type: "group", id: groupCache[0].groupId, name: groupCache[0].groupId}];
                  else 
                    response.concat([{type: "group", id: groupCache[0].groupId, name: groupCache[0].groupId}]);
                }
                data=true;
              }
              if(eventdocs.length > 0) {
                if(!req.query.onlyMeta == "true") {
                  if(response.length == 0) response=eventdocs;
                  else response.concat(eventdocs);
                }
                else {
                  if(response.length == 0) response = _.compact(eventdocs.map(function(event){
                    if(req.session.usr.role == "innostaja" && event.toInnostaja == "true") {
                      return{type: "event", id: event._id, name: event.name}
                    }
                    if(req.session.usr.role == "EVI" && event.toEVI == "true") {
                      return{type: "event", id: event._id, name: event.name}
                    }
                    if(req.session.usr.role == "admin") {
                      return{type: "event", id: event._id, name: event.name}
                    }
                  }));
                  else response.concat(eventdocs.map(function(event){return {type: "event", id: event._id, name: event.name}}));
                }
                data=true;
              }
              if(userdocs.length > 0 && req.session.usr.role == "admin") {
                if(!req.query.onlyMeta == "true") {
                  if(response.length == 0) response=userdocs;
                  else response.concat(userdocs);
                }
                else {
                  if(response.length == 0) response = userdocs.map(function(user){return {type: "user", id: user._id, name: user.name}});
                  else response.concat(eventdocs.map(function(user){return {type: "user", id: user._id, name: user.name}}));
                }
                data=true;
              }
              if(data) {
                res.send(response);
              }
              else res.send(new Array());
            }
          });
        });
      });
    });
  }
})

router.get('/getSettings', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin" && req.query != "") {
    var db = req.db;
    var collection = db.get('globalsettings');
    collection.findOne({}, function(e,docs){
      if(e) console.log(e);
      console.log(docs);
      res.send(docs.settings);
    })
  }
  else res.send(403);
})

router.get('/changeSettings', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin" && req.query != "") {
    var db = req.db;
    var collection = db.get('globalsettings');
    collection.update({}, {$set: { settings: JSON.parse(req.query.settings) }});
    res.send("OK");
  }
  else res.send(403);
})

router.get('/setEvent', function(req, res) {
  if(req.session.loggedIn && req.session.usr.role == "admin"){
    var db = req.db;
    var collection = db.get('eventcollection');
    collection.insert({
        name: req.query.name, 
        startTime: req.query.startTime, 
        endTime: req.query.endTime, 
        closes: req.query.closes, 
        location: req.query.location, 
        toInnostaja: req.query.toInnostaja, 
        toEVI: req.query.toEVI, 
        toIndividual: req.query.toIndividual,
        max: req.query.max, 
        participants: JSON.stringify(new Array),
        reservedParticipants: JSON.stringify(new Array), 
        info: req.query.info, 
        releaseTime: req.query.releaseTime, 
        jobs: req.query.jobs, 
        type: req.query.type
      },
      function(e,docs){
        res.send("OK");
      }
    );
  }
  else res.send(403);
});

router.get('/getEvent', function(req, res) {
  if(req.session.loggedIn){
    var db = req.db;
    var temp = new Array;
    var collection = db.get('eventcollection');
    collection.find({ _id: req.query.id },{},function(e,docs){
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
      });
      if(temp.length > 0) {
        res.send(temp);
      }
      else res.send(403);
    });
  }
  else res.send(503);
});

module.exports = router;
