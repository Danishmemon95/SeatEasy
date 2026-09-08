import { Router } from "express";
import { checkAuth, login, logout, register, verifyUser } from "./authController";
import { protectRoute } from "../middleware/authMiddleware";

const router = Router()

router.get("/checkAuth", protectRoute, checkAuth)
router.get("/verify", verifyUser)
router.post("/register", register)
router.post("/login", login)
router.post("/logout", logout)

export default router