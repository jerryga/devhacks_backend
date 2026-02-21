import express from "express";
import { getUserVacs } from "../controllers/userVacController.js";

const router = express.Router();

router.get("/history", getUserVacs);

export const userVacRoutes = router;
