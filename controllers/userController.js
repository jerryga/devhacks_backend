import { supabaseClient } from "../tools/supabaseClient.js";

async function getUser(req, res) {
  try {
    const targetUserId = req.user?.sub;
    if (!targetUserId) {
      return res.status(401).send("Unauthorized");
    }

    const { data, error } = await supabaseClient
      .from("user")
      .select(
        "id, email, first_name, last_name, gender, address, phone, birth, conditions, pregnant",
      )
      .eq("id", targetUserId)
      .maybeSingle();

    if (error) {
      return res.status(500).send("Error fetching user: " + error.message);
    }

    if (!data) {
      return res.status(404).send("User not found");
    }

    return res.status(200).json({
      message: "User fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).send("Error fetching user: " + error.message);
  }
}

export { getUser };
