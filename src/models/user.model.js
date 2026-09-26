import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    displayName: { 
        type: String, 
        required: true, 
        trim: true, 
        minlength: 2, 
        maxLength: 80, 
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String
        required: true,
        select: false,
    },
    emailVerificationAt: {
        type: String,
        default: null,
    },
    emailVerificationToken: {
        type: String,
        default: null,
    },
    emailVerificationExpires: {
        type: String,
        default: null,
    },
    passwordResetTokenHash:{
        type: String,
        select: false,
    },
     passwordResetExpiresAt:{
        type: Daate,
        select: false,
    },
    sessionVersion: {
        type: Number,
        default: 0,
        select: false,
    },
    plan: {
        type: String,
        enum: ["Free"],
        default: "free"
    },
}
{ timeStamp: true },
) 

export 