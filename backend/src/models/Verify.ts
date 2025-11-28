import mongoose from "mongoose";

const verifySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    verificationCode: {
      type: String, // random string sent by email/sms
      default: null,
    },
    verificationCodeExpires: {
      type: Date, // optional expiration date
      default: null,
    },
  },
);

const Verify = mongoose.model("Verify", verifySchema);

export default Verify;
