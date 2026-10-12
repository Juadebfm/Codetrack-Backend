import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minLength: 2,
      maxLength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Provide a valid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationTokenHash: {
      type: String,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    // Retain earlier links during resend; consume all links after a successful use.
    verificationTokens: { type: [{ hash: String, expiresAt: Date }], select: false, default: [] },
    resetTokens: { type: [{ hash: String, expiresAt: Date }], select: false, default: [] },
    plan: {
      type: String,
      enum: ["Free"],
      default: "Free",
    },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
