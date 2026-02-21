import express from "express";
import {
  createUserVac,
  getUserVacs,
  getEligibleVacs,
  getOverdueVacs,
} from "../controllers/userVacController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", authMiddleware, getUserVacs);
router.post("/appoint", authMiddleware, createUserVac);
router.get("/eligible", authMiddleware, getEligibleVacs);
router.get("/overdue", authMiddleware, getOverdueVacs);
export const userVacRoutes = router;
