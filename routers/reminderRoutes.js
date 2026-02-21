import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  scheduleReminder,
  listReminders,
  cancelReminder,
} from "../controllers/reminderController.js";

const router = express.Router();

router.post("/schedule", authMiddleware, scheduleReminder);
router.get("/", authMiddleware, listReminders);
router.delete("/:jobId", authMiddleware, cancelReminder);

export const reminderRoutes = router;
