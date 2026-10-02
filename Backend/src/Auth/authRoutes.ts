import { Router } from "express";
import { checkAuth, login, logout, register, verifyUser } from "./authController";
import { protectRoute } from "../middleware/authMiddleware";
import {
    authLimiter,
    loginLimiter,
    registerLimiter,
    verifyLimiter,
} from "../middleware/rateLimiters";

const router = Router();

router.get("/checkAuth", protectRoute, checkAuth);
router.post("/logout", logout);


// auth limit routes
router.use(authLimiter);

router.get("/verify", verifyLimiter, verifyUser);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

export default router;
