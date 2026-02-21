import express from "express";
import { findVaccine, getVaccine } from "../controllers/vaccineController.js";

const router = express.Router();

router.get("/", getVaccine);
router.get("/search", findVaccine);

export const vaccineRoutes = router;
