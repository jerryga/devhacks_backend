import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { scheduleReminder } from "../controllers/reminderController.js";

const router = express.Router();

router.post("/schedule", authMiddleware, scheduleReminder);

export const reminderRoutes = router;
