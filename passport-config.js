// will handle the configuration of Passport here
// used to define the local authentication startegy using username and password
import {Strategy as LocalStrategy} from 'passport-local';
import bcrypt from 'bcrypt'; // library to hash passwords securely
import User from './models/User.js';

// initialize Passport configuartion
const initializePassport = (passport) => {
    // add LocalStrategy
    passport.use(new LocalStrategy(async (username, password, done) =>{
        try{
            // try finding the user in the database with the given username
            const user = await User.findOne({username});
            // if no user, return failure and message
            if (!user){
                return done(null, false, {message: 'No user with that username'});
            }
            // compare the given password with the hashed password stored in the database
            const match = await bcrypt.compare(password, user.hash);
            // if matches, success
            if (match){
                return done(null, user);
            // failure and message if doesn't match
            }else{
                return done(null,false, {message: 'Incorrect password'});
            }
        }catch (error){
            // catch any sort of error that might occur
            return done(error);
        }
    }));

    // serialize the user into a session
    // Passport will save the user ID to the session to keep user logged in
    passport.serializeUser((user, done) => done(null, user.id));

    // deserialize user into a session
    // whne user makes future requests, session ID is used to find and load user info
    passport.deserializeUser(async (id, done) =>{
        try{
            // try finsing user by thier ID from the database
            const user = await User.findById(id);
            done(null, user);
        } catch(error){
            done(error);
        }
    });
};

export default initializePassport;