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

async function getUserVacs(req, res) {
  const user_id =
    req.query.user_id ||
    req.params.user_id ||
    req.body?.user_id ||
    req.user?.sub;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  try {
    const { data, error } = await supabaseClient
      .from("user_vac")
      .select("*")
      .eq("user_id", user_id);

    if (error) {
      return res
        .status(500)
        .json({ message: "Error fetching user_vacs: " + error.message });
    }

    const { data: vaccines, error: vacError } = await supabaseClient
      .from("vaccine")
      .select("*")
      .in("id", data ? data.map((uv) => uv.vac_id) : []);

    if (vacError) {
      return res
        .status(500)
        .json({ message: "Error fetching vaccines: " + vacError.message });
    }

    const userVacsWithDetails = (data || []).map((uv) => {
      const vacDetails = (vaccines || []).find((v) => v.id === uv.vac_id);
      return {
        ...uv,
        vac_details: vacDetails || null,
      };
    });

    return res.status(200).json({
      message: "UserVacs fetched successfully",
      data: userVacsWithDetails,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user_vacs: " + error.message });
  }
}

export { createUserVac, getUserVacs };
