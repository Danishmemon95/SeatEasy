import { Router } from "express";
import { login, logout, register, verifyUser } from "./authController";

const router = Router()

router.get("/verify", verifyUser)
router.post("/register", register)
router.post("/login", login)
router.post("/logout", logout)

export default router