import { Router } from "express";
import { checkAuth, login, logout, register, updateMe, verifyUser } from "./authController";
import { protectRoute } from "../middleware/authMiddleware";
import {
    authLimiter,
    loginLimiter,
    registerLimiter,
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

export default router;
