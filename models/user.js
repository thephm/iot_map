var bcrypt = require("bcryptjs");
var mongoose = require("mongoose");

var SALT_FACTOR = 10;

var userSchema = mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  displayName: String,
  bio: String
});

// "pre-save action": before saving the user, encrypt the password
userSchema.pre("save", async function() {
  if (!this.isModified("password")) {
    return;
  }

  var salt = await bcrypt.genSalt(SALT_FACTOR);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.checkPassword = function(guess, done) {
  bcrypt.compare(guess, this.password, function(err, isMatch) {
    done(err, isMatch);
  });
};

userSchema.methods.name = function() {
  return this.displayName || this.username;
};

var User = mongoose.model("User", userSchema);

module.exports = User;
