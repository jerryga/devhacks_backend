import express from "express";
import {
  createUserVac,
  getUserVacs,
} from "../controllers/userVacController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", authMiddleware, getUserVacs);
router.post("/appoint", authMiddleware, createUserVac);
export const userVacRoutes = router;
