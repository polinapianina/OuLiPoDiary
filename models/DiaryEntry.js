import mongoose from "mongoose";
import fieldEncryptionPlugin from 'mongoose-field-encryption';

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

// apply the plugin to encrypt the `content` field
DiaryEntrySchema.plugin(fieldEncryptionPlugin.fieldEncryption, {
    fields: ['content'],               // fields to encrypt
    secret: process.env.ENCRYPTION_KEY // from your .env
});

// exporting the model
const DiaryEntry = mongoose.model('DiaryEntry', DiaryEntrySchema);
export default DiaryEntry;