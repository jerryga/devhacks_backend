import { supabaseClient } from "../tools/supabaseClient.js";

function login(req, res) {
  res.send("Login successful");
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

export { login, signup };
