import { supabaseClient } from "../tools/supabaseClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const ACCOUNT_TABLE_BY_ROLE = {
  user: "user",
  clinic: "clinic",
};

function resolveAuthRole(body = {}) {
  const role = (body.role || "user").toString().trim().toLowerCase();
  if (!ACCOUNT_TABLE_BY_ROLE[role]) {
    return { error: "Invalid role. Use 'user' or 'clinic'." };
  }
  return { role, table: ACCOUNT_TABLE_BY_ROLE[role] };
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    const roleResolution = resolveAuthRole(req.body);
    if (roleResolution.error) {
      return res.status(400).send(roleResolution.error);
    }
    const { role, table } = roleResolution;

    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error } = await supabaseClient
      .from(table)
      .select("id, email, password")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).send("Error during login: " + error.message);
    }

    if (!user || !user.password) {
      return res.status(401).send("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid email or password");
    }

    const token = jwt.sign(
      { sub: user.id || user.email, email: user.email, role },
      getJwtSecret(),
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    return res.status(500).send("Error during login: " + error.message);
  }
}

async function signup(req, res) {
  try {
    const { email, password } = req.body ?? {};
    const roleResolution = resolveAuthRole(req.body);
    if (roleResolution.error) {
      return res.status(400).send(roleResolution.error);
    }
    const { table } = roleResolution;

    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingUsers, error: lookupError } = await supabaseClient
      .from(table)
      .select("email")
      .eq("email", normalizedEmail);

    if (lookupError) {
      return res
        .status(500)
        .send("Error during signup: " + lookupError.message);
    }

    if ((existingUsers ?? []).length > 0) {
      return res.status(400).send("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: insertError } = await supabaseClient
      .from(table)
      .insert({ email: normalizedEmail, password: hashedPassword });

    if (insertError) {
      return res
        .status(500)
        .send("Error during signup: " + insertError.message);
    }

    return res.status(201).send("Signup successful");
  } catch (error) {
    return res.status(500).send("Error during signup: " + error.message);
  }
}

async function updateUserProfile(req, res) {
  try {
    const {
      first_name,
      last_name,
      gender,
      address,
      phone,
      birth,
      conditions,
      pregnant,
    } = req.body;

    const targetUserId = req.user?.sub;
    if (!targetUserId) {
      return res.status(401).send("Unauthorized");
    }

    const updatePayload = {
      first_name: first_name,
      last_name: last_name,
      gender,
      address,
      phone,
      birth: birth,
      conditions: conditions,
      pregnant: pregnant,
    };

    const filteredPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(filteredPayload).length === 0) {
      return res.status(400).send("No profile fields provided");
    }

    const { error } = await supabaseClient
      .from("user")
      .update(filteredPayload)
      .eq("id", targetUserId);

    if (error) {
      return res.status(500).send("Error updating profile: " + error.message);
    }

    return res.status(200).send("Profile updated successfully");
  } catch (error) {
    return res.status(500).send("Error updating profile: " + error.message);
  }
}

export { login, signup, updateUserProfile };
