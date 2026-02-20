import { supabaseClient } from "../tools/supabaseClient.js";

async function createUserVac(req, res) {
  const { user_id, vac_id } = req.body;

  if (!user_id || !vac_id) {
    return res.status(400).json({ message: "user_id and vac_id are required" });
  }

  const user = await supabaseClient
    .from("user")
    .select("id")
    .eq("id", user_id)
    .maybeSingle();

  if (!user || !user.data) {
    return res.status(404).json({ message: "User not found" });
  }

  const vac = await supabaseClient
    .from("vac")
    .select("id")
    .eq("id", vac_id)
    .maybeSingle();

  if (!vac || !vac.data) {
    return res.status(404).json({ message: "Vac not found" });
  }

  const { data, error } = await supabaseClient
    .from("user_vac")
    .insert({ user_id, vac_id });
  if (error) {
    return res
      .status(500)
      .json({ message: "Error creating user_vac: " + error.message });
  }
  return res
    .status(201)
    .json({ message: "UserVac created successfully", data });
}

export { createUserVac };
