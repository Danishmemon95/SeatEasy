import { Router } from "express";
import {
    changePassword,
    checkAuth,
    forgotPassword,
    login,
    logout,
    register,
    resendVerification,
    resetPassword,
    updateMe,
    verifyUser,
} from "./authController";
import { protectRoute } from "../middleware/authMiddleware";
import {
    authLimiter,
    changePasswordLimiter,
    forgotPasswordLimiter,
    loginLimiter,
    registerLimiter,
    resendVerificationLimiter,
    resetPasswordLimiter,
    verifyLimiter,
} from "../middleware/rateLimiters";

const router = Router();

router.get("/checkAuth", protectRoute, checkAuth);
// Profile update (city). Cheap and session-bound like checkAuth, so not behind the credential limiters.
router.patch("/me", protectRoute, updateMe);
router.post("/logout", logout);


// auth limit routes
router.use(authLimiter);

router.get("/verify", verifyLimiter, verifyUser);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/resend-verification", resendVerificationLimiter, resendVerification);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
// Runs bcrypt on a typed password, so it sits behind the limiters unlike PATCH /me.
router.patch("/me/password", changePasswordLimiter, protectRoute, changePassword);

export default router;
