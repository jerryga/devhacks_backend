import express from "express";
import { getUserVacs } from "../controllers/userVacController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", authMiddleware, getUserVacs);

export const userVacRoutes = router;
