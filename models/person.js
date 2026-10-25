var mongoose = require("mongoose");

var personSchema = mongoose.Schema({
  slug: String,
  first_name: { type: String, required: true },
  last_name: { type: String, required: false },
  title: String,
  url: String,
  linkedin_id: String,
  facebook_id: String,
  instagram_id: String,
  bluesky_id: String,
  x_id: String,
  github_id: String,
  medium_id: String,
  threads_id: String,
  // Mixed entries retain unresolved legacy values without coercing or dropping them.
  positions: [mongoose.Schema.Types.Mixed],
  birthday: { type: String, required: false, select: false },
  date_added: { type: Date, default: Date.now }
});

var Person = mongoose.model("Person", personSchema);

module.exports = Person;
