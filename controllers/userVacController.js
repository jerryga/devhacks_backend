import { supabaseClient } from "../tools/supabaseClient.js";

async function createUserVac(req, res) {
  const { user_id, vac_id, clinic_id, dose, date } = req.body;

  if (!user_id || !vac_id || !clinic_id) {
    return res
      .status(400)
      .json({ message: "user_id, vac_id, and clinic_id are required" });
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
    .insert({ user_id, vac_id, clinic_id, dose, date });
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

async function getEligibleVacs(req, res) {
  const user_id =
    req.query.user_id ||
    req.params.user_id ||
    req.body?.user_id ||
    req.user?.sub;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  try {
    const { data: user, error: userError } = await supabaseClient
      .from("user")
      .select("*")
      .eq("id", user_id)
      .maybeSingle();

    if (userError) {
      return res
        .status(500)
        .json({ message: "Error fetching user: " + userError.message });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { data: vaccines, error: vacError } = await supabaseClient
      .from("vaccine")
      .select("*");

    if (vacError) {
      return res
        .status(500)
        .json({ message: "Error fetching vaccines: " + vacError.message });
    }

    const userAge = user.birth
      ? Math.floor(
          (Date.now() - new Date(user.birth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
        )
      : null;
    const eligibleVacs = (vaccines || []).filter((vac) => {
      if (!vac.conditions || vac.conditions.length === 0) {
        return true;
      }

      if (vac.min_age && (userAge === null || userAge < vac.min_age)) {
        return false;
      }

      if (vac.max_age && (userAge === null || userAge > vac.max_age)) {
        return false;
      }

      return vac.conditions.every((cond) => user.conditions?.includes(cond));
    });

    return res.status(200).json({
      message: "Eligible vaccines fetched successfully",
      data: eligibleVacs,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching eligible vaccines: " + error.message });
  }
}

export { createUserVac, getUserVacs, getEligibleVacs };
