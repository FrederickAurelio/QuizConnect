import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import User from "../../models/User.js";
import { v4 as uuidv4 } from "uuid";
import { avatars } from "../../utils/constant.js";
import Verify from "../../models/Verify.js";
import { sendVerificationEmail } from "../../utils/brevo.js";
import { differenceInSeconds, addMinutes } from "date-fns";
import { handleControllerError } from "../../utils/handle-control-error.js";

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.email(),
  password: z.string().min(6),
  verificationCode: z.string().min(6),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const sendCodeSchema = z.object({
  email: z.email(),
});

const resetPasswordSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  verificationCode: z.string().min(6),
});

const editProfileSchema = z.object({
  username: z.string().min(3).max(50),
  avatar: z.string(),
});

// ---------------- REGISTER ----------------
export const registerUser = async (req: Request, res: Response) => {
  try {
    const parsedData = registerSchema.parse(req.body);
    const { username, email, password, verificationCode } = parsedData;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already in use",
        data: null,
        errors: null,
      });
    }

    const dbVerificationCode = await Verify.findOne({ email });
    if (
      !dbVerificationCode ||
      dbVerificationCode.verificationCode !== verificationCode ||
      dbVerificationCode.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({
        message: "Verification code is incorrect or has expired.",
        data: null,
        errors: null,
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const randomIndex: number = Math.floor(Math.random() * avatars.length);
    const randomAvatarSrc = avatars[randomIndex]?.src ?? "";

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      avatar: randomAvatarSrc,
    });
    await dbVerificationCode.deleteOne();

    req.session.userId = newUser._id;
    req.session.type = "auth";
    req.session.username = username;
    req.session.avatar = randomAvatarSrc;

    return res.status(201).json({
      message: "User registered successfully",
      data: {
        userId: newUser._id,
        username: newUser.username,
        avatar: newUser.avatar || "",
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- LOGIN ----------------
export const loginUser = async (req: Request, res: Response) => {
  try {
    const parsedData = loginSchema.parse(req.body);
    const { email, password } = parsedData;

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(400).json({
        message: "Invalid email or password",
        data: null,
        errors: null,
      });
    }

    const passwordMatch = await bcrypt.compare(password, existingUser.password);
    if (!passwordMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
        data: null,
        errors: null,
      });
    }

    req.session.userId = existingUser._id;
    req.session.type = "auth";
    req.session.username = existingUser.username;
    req.session.avatar = existingUser.avatar;

    return res.status(200).json({
      message: "Login successful",
      data: {
        userId: existingUser._id,
        username: existingUser.username,
        avatar: existingUser.avatar || "",
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- LOGOUT ----------------
export const logoutUser = (req: Request, res: Response) => {
  if (!req.session) {
    return res.status(400).json({
      message: "No active session found",
      data: null,
      errors: null,
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: "Failed to logout",
        data: null,
        errors: null,
      });
    }

    res.clearCookie("connect.sid");

    return res.status(200).json({
      message: "Logout successful",
      data: null,
      errors: null,
    });
  });
};

// ---------------- RESET PASSWORD ----------------
export const resetPasswordUser = async (req: Request, res: Response) => {
  try {
    const parsedData = resetPasswordSchema.parse(req.body);
    const { email, password, verificationCode } = parsedData;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: "We couldn't found the user with this email",
        data: null,
        errors: null,
      });
    }

    const dbVerificationCode = await Verify.findOne({ email });
    if (
      !dbVerificationCode ||
      dbVerificationCode.verificationCode !== verificationCode ||
      dbVerificationCode.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({
        message: "Verification code is incorrect or has expired.",
        data: null,
        errors: null,
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;

    await user.save();
    await dbVerificationCode.deleteOne();

    req.session.userId = user._id;
    req.session.type = "auth";
    req.session.username = user.username;
    req.session.avatar = user.avatar;

    return res.status(201).json({
      message: "Password reset successfully",
      data: {
        userId: user._id,
        username: user.username,
        avatar: user.avatar || "",
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- CHANGE PROFILE ----------------
export const editProfileUser = async (req: Request, res: Response) => {
  try {
    const parsedData = editProfileSchema.parse(req.body);
    const { username, avatar } = parsedData;

    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        message: "We couldn't found the user",
        data: null,
        errors: null,
      });
    }

    user.avatar = avatar;
    user.username = username;

    await user.save();

    req.session.username = user.username;
    req.session.avatar = user.avatar;

    return res.status(201).json({
      message: "Profile updated successfully",
      data: {
        userId: user._id,
        username: user.username,
        avatar: user.avatar || "",
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- MIDDLEWARE ----------------
export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.session?.userId && req.session?.type === "auth") {
    return next();
  }

  return res.status(401).json({
    message: "Unauthorized: You must be logged in to access this route",
    data: null,
    errors: null,
  });
};

// ---------------- GET USER ----------------
export const getUser = async (req: Request, res: Response) => {
  try {
    // 1️⃣ Check if session exists
    if (!req.session) {
      return res.status(500).json({
        message: "Session not initialized",
        data: null,
        errors: null,
      });
    }

    // 2️⃣ Signed-in user
    if (req.session.type === "auth" && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (!user) {
        // fallback if DB missing
        return res.status(404).json({
          message: "User not found",
          data: null,
          errors: null,
        });
      }

      return res.status(200).json({
        message: "Signed-in user fetched",
        data: {
          userId: user._id.toString(),
          username: user.username,
          avatar: user.avatar || "",
        },
        errors: null,
      });
    }

    // 3️⃣ Guest user in session
    if (req.session.type === "guest" && req.session.userId) {
      return res.status(200).json({
        message: "Guest user fetched",
        data: {
          userId: req.session.userId,
          username: req.session.username,
          avatar: req.session.avatar,
        },
        errors: null,
      });
    }

    // 4️⃣ No session user → create guest
    const tempId = `guest_${uuidv4().slice(0, 8)}`;
    const tempUsername = `Guest_${tempId.slice(-4)}`;

    const randomIndex: number = Math.floor(Math.random() * avatars.length);
    const randomAvatarSrc = avatars[randomIndex]?.src ?? "";

    req.session.userId = tempId;
    req.session.type = "guest";
    req.session.username = tempUsername;
    req.session.avatar = randomAvatarSrc;

    return res.status(200).json({
      message: "Guest session created",
      data: {
        userId: tempId,
        username: tempUsername,
        avatar: randomAvatarSrc,
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- SEND VERIFICATION CODE ----------------
export const sendCode = async (req: Request, res: Response) => {
  try {
    const parsedData = sendCodeSchema.parse(req.body);
    const { email } = parsedData;

    // 1. Check existing code
    const existing = await Verify.findOne({ email });

    if (existing) {
      const now = new Date();
      // calculate when the last code was sent
      const codeSentAt = new Date(
        existing.verificationCodeExpires.getTime() - 5 * 60 * 1000
      );
      const cooldownEnd = addMinutes(codeSentAt, 2); // 2 min cooldown

      if (now < cooldownEnd) {
        const secondsLeft = differenceInSeconds(cooldownEnd, now);
        return res.status(429).json({
          message: `Please wait ${secondsLeft}s before requesting a new code.`,
          data: null,
          errors: null,
        });
      }
    }

    // 2. Generate new verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationCodeExpires = addMinutes(new Date(), 5); // expires in 5 minutes

    // 3. Save new code
    await Verify.findOneAndUpdate(
      { email },
      { verificationCode, verificationCodeExpires },
      { upsert: true, new: true }
    );

    // 4. Send email
    await sendVerificationEmail({ email, verificationCode });

    return res.status(200).json({
      message: "Verification code sent! Please check your email.",
      data: null,
      errors: null,
    });
  } catch (error: any) {
    return handleControllerError(res, error);
  }
};
