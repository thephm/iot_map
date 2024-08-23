var passport = require("passport");
var User = require("./models/user");

module.exports = function() {

    // turn a user object into an ID. Call done with no error and the user’s ID
    passport.serializeUser(function(user, done) {
        done(null, user._id);
        });

    // turn the ID into a user object. Once finished, call done with any errors
    // and the user object
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });
};

var LocalStrategy = require("passport-local").Strategy;

// tell Passport to use a local strategy
passport.use("login", new LocalStrategy(function(username, password, done) {

    // use a MongoDB query to get one user
    User.findOne({ username: username }, function(err, user) {
    if (err) { return done(err); }

        // if there is no user with the supplied username, return false with an
        // error message. Call the checkPassword method defined in the User model
        if (!user) {
            return done(null, false, { message: "No user has that username!" });
        }

        user.checkPassword(password, function (err, isMatch) {

            if (err) { return done(err); }

            // if a match, return the current user with no error
            if (isMatch) {
                return done(null, user);
            } else {
                // if not a match, return false with an error message
                return done(null, false, { message: "Invalid password." });
            }
        });
    });
}));
