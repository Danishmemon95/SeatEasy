import { Router } from "express";
import { applyOrg, checkAuth, login, logout, register, verifyUser } from "./authController";
import { protectRoute, requireRole } from "../middleware/authMiddleware";
import {
    authLimiter,
    loginLimiter,
    registerLimiter,
    verifyLimiter,
} from "../middleware/rateLimiters";

const router = Router();

/**
 * Session routes, deliberately unthrottled.
 *
 * checkAuth runs on every page load and on every window refocus, and logout is
 * how a user gets out of a bad state — throttling either punishes normal use and
 * would leave a signed-in user unable to even sign out. Both are cheap: a cookie
 * verify and one indexed lookup, no bcrypt.
 */
router.get("/checkAuth", protectRoute, checkAuth);
router.post("/logout", logout);

router.post("/applyOrg", protectRoute, requireRole("buyer"), applyOrg)

/**
 * Credential routes. These run bcrypt or mint tokens, so they carry both the
 * per-route limits and the shared backstop that catches an attacker spreading
 * attempts across all of them.
 */
router.use(authLimiter);

router.get("/verify", verifyLimiter, verifyUser);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

export default router;
