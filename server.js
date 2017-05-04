var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost/")

var db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error"));
db.once("open", function(callback){
  console.log("Connection establihed");
})

var Schema = mongoose.Schema;

var bugSchema = new Schema({
  bugName: String,
  bugColor: String,
  Genus: String
});

var Bug = mongoose.model("Bug", bugSchema);

var Bee = new Bug({
  bugName: "Scruffy",
  bugColour: "Orange",
  Genus: "Bombus"
});

Bee.save(function(error) {
  console.log("Your bee has been saved!");
  if (error) {
    console.error(error);
  }
});

Bee.find(function(err, bees){
  if(err) return console.error(err);
  console.log(bees);
})
