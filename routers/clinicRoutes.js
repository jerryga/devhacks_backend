import express from "express";
import {
  signup,
  login,
  getAllClinics,
  getClinicById,
  updateClinicProfile,
} from "../controllers/clinicController.js";

const router = express.Router();
router.get("/", getAllClinics);
router.get("/:clinic_id", getClinicById);
router.post("/signup", signup);
router.post("/login", login);
router.put("/updateProfile", login, updateClinicProfile);
export const clinicRoutes = router;
