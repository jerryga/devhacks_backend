import express from "express";
import {
  createUserVac,
  getUserVacs,
  getEligibleVacs,
} from "../controllers/userVacController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", authMiddleware, getUserVacs);
router.post("/appoint", authMiddleware, createUserVac);
router.get("/eligible", authMiddleware, getEligibleVacs);
export const userVacRoutes = router;
