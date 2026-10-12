import { Router } from "express";
import { authRateLimit } from "../middleware/auth-rate-limit.js";
import { authenticate } from "../middleware/authenticate.js";

import * as authController from "../controllers/auth.controller.js";

const router = Router();

// Route names an endpoint, while controller contains the logic of that endpoint

router.post("/register", authRateLimit, authController.register);
router.get("/verify-email", authRateLimit, authController.verifyEmail);
router.post(
  "/resend-verification",
  authRateLimit,
  authController.resendVerification,
);
router.post("/login", authRateLimit, authController.login);
router.post("/refresh", authRateLimit, authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", authRateLimit, authController.forgotPassword);
router.post("/reset-password", authRateLimit, authController.resetPassword);
router.get("/me", authenticate, authController.me);

export default router;
