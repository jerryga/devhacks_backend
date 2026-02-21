import express from "express";
import { signup, login } from "../controllers/clicnicController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
export const clinicRoutes = router;
