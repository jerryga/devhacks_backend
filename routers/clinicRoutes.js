import express from "express";
import {
  signup,
  login,
  getAllClinics,
  getClinicById,
} from "../controllers/clinicController.js";

const router = express.Router();
router.get("/", getAllClinics);
router.get("/:clinic_id", getClinicById);
router.post("/signup", signup);
router.post("/login", login);
export const clinicRoutes = router;
