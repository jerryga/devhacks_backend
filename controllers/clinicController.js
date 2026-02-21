import {
  login as unifiedLogin,
  signup as unifiedSignup,
} from "./authController.js";
import { supabaseClient } from "../tools/supabaseClient.js";

function withClinicRole(req) {
  req.body = { ...(req.body || {}), role: "clinic" };
}

async function login(req, res) {
  withClinicRole(req);
  return unifiedLogin(req, res);
}

async function signup(req, res) {
  withClinicRole(req);
  return unifiedSignup(req, res);
}

async function getAllClinics(req, res) {
    try {
        const { data, error } = await supabaseClient
        .from("clinic")
        .select("*");

        if (error) {
            return res.status(500).send("Error fetching clinics: " + error.message);
        }

        return res.status(200).json({
            message: "Clinics fetched successfully",
            data: data || [],
            });
    } catch (error) {
        return res.status(500).send("Error fetching clinics: " + error.message);
    } 
}

export { login, signup, getAllClinics };

