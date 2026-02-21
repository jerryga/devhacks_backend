import express from "express";
import {
  signup,
  login,
  getAllClinics,
} from "../controllers/clinicController.js";

const router = express.Router();
router.get("/", getAllClinics);
router.post("/signup", signup);
router.post("/login", login);
export const clinicRoutes = router;
