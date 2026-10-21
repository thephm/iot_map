var mongoose = require("mongoose");

var personSchema = mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: false },
  birthday: { type: String, required: false },
  date_added: { type: Date, default: Date.now }
});

var Person = mongoose.model("Person", personSchema);

module.exports = Person;
