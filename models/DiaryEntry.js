import mongoose from "mongoose";

const DiaryEntrySchema = new mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    content: {type: String, required: true},
    techniqueTag: {type: String},
    status: {type: String, enum: ['private', 'public'], default: 'private'},
    createdAt: {type: Date, default: Date.now},
    timer: {
        enabled: {type: Boolean, default: false},
        duration: {type: Number}
    },
    deleted: {type: Boolean, default: false}
});

const DiaryEntry = mongoose.model('DiaryEntry', DiaryEntrySchema);
export default DiaryEntry;