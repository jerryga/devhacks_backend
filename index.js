import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { authRoutes } from "./routers/authRoutes.js";
import { userRoutes } from "./routers/userRoutes.js";
import { vaccineRoutes } from "./routers/vaccineRoutes.js";
import { clinicRoutes } from "./routers/clinicRoutes.js";
import { userVacRoutes } from "./routers/userVacRoutes.js";
import { reminderRoutes } from "./routers/reminderRoutes.js";
import { ensureReminderWorker } from "./controllers/reminderController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/clinic", clinicRoutes);
app.use("/api/vaccine", vaccineRoutes);
app.use("/api/user_vac", userVacRoutes);
app.use("/api/reminder", reminderRoutes);
ensureReminderWorker();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
