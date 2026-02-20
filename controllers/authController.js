import { supabaseClient } from "../tools/supabaseClient.js";

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user, error } = await supabaseClient
      .from("user")
      .select("email, password")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).send("Error during login: " + error.message);
    }

    if (!user || user.password !== password) {
      return res.status(401).send("Invalid email or password");
    }

    return res.status(200).send("Login successful");
  } catch (error) {
    return res.status(500).send("Error during login: " + error.message);
  }
}

function signup(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password are required");
  }

  supabaseClient
    .from("user")
    .select("email")
    .eq("email", email)
    .then(({ data, error }) => {
      if (error) {
        return res.status(500).send("Error during signup: " + error.message);
      }

      if (data.length > 0) {
        return res.status(400).send("Email already exists");
      }

      supabaseClient
        .from("user")
        .insert({ email, password })
        .then(({ error }) => {
          if (error) {
            return res
              .status(500)
              .send("Error during signup: " + error.message);
          }
          res.status(201).send("Signup successful");
        });
    });
}

function updateUserProfile(req, res) {
  const { id, firstName, lastName, gender, address, phone, dateOfBirth, chronicConditions, preganancyStatus } = req.body;
  const { error } = supabaseClient
  .from("user")
  .update({ first_name: firstName, 
    last_name: lastName,
    gender: gender,
    address: address,
    phone: phone,
    date_of_birth: dateOfBirth,
    chronic_conditions: chronicConditions,
    preganancy_status: preganancyStatus
  })
  .eq("id", id)
  .then(() => {
    res.status(200).send("Profile updated successfully");
  })
  .catch((error) => {
    res.status(500).send("Error updating profile: " + error.message);
  });
}

export { login, signup, updateUserProfile };
