import {
  login as unifiedLogin,
  signup as unifiedSignup,
} from "./authController.js";

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

export { login, signup };
