import mongoose from "mongoose";

const learningLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.OgbjectId,
        ref: "User"
        required: true,
        index: true,
    },
    tittle: {
        type: String,
        required: true,
        trim: true,
        maxLength: 160,
    },
    tag: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxLength: 40
    },
    durationMinutes: {
        type: Number,
        required: true,
        min: 1,
        max: 1440, //24hrs
    },
    loggedAt: {
        type: Date,
        required: true,
        duration: true,
        
    },
} { timestamps = true })

learningLogSchema.index({ user: 1, loggedAt: -1 })

export const Learninglog = mongoose.........