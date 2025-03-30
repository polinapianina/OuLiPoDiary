import mongoose from 'mongoose';

// each user has unique username and hashed password.
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    hash: { type: String, required: true }, // This will store the hashed password
    entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DiaryEntry' }] // Reference to diary entries
});

// create user model based on UserSchema.
const User = mongoose.model('User', UserSchema);

export default User;