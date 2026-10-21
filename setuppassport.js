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
        User.findById(id).exec().then(function(user) {
            done(null, user);
        }).catch(done);
    });
};

var LocalStrategy = require("passport-local").Strategy;

// tell Passport to use a local strategy
passport.use("login", new LocalStrategy(function(username, password, done) {
    var invalidCredentials = { message: "Invalid username or password" };
    if (typeof username !== "string" || typeof password !== "string") {
        return done(null, false, invalidCredentials);
    }

    // use a MongoDB query to get one user
    User.findOne({ username: username }).exec().then(function(user) {

        // if there is no user with the supplied username, return false with an
        // error message. Call the checkPassword method defined in the User model
        if (!user) {
            return done(null, false, invalidCredentials);
        }

        user.checkPassword(password, function (err, isMatch) {

            if (err) { return done(err); }

            // if a match, return the current user with no error
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, invalidCredentials);
            }
        });
    }).catch(done);
}));
