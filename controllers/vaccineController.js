import { supabaseClient } from "../tools/supabaseClient.js";

async function getVaccine(req, res) {
    try {
        const { data, error } = await supabaseClient
        .from("vaccine")
        .select("*");

        if (error) {
            return res.status(500).send("Error fetching vaccines: " + error.message);
        }

        return res.status(200).json({
            message: "Vaccines fetched successfully",
            data: data || [],
            });
    } catch (error) {
        return res.status(500).send("Error fetching vaccines: " + error.message);
    }
}

async function findVaccine(req, res) {
    try {
    const q = req.query.q?.trim();
    if (!q) {
        return res.status(400).send("Search query is required");
    }

    const { data, error } = await supabaseClient
        .from("vaccine")
        .select("*")
        .ilike("name", `%${q}%`);

    if (error) {
        return res.status(500).send("Error fetching vaccines: " + error.message);
    }

    return res.status(200).json({
        message: "Vaccines fetched successfully",
        data: data || [],
    });
    } catch (error) {
    return res.status(500).send("Error fetching vaccines: " + error.message);
    }
}

export { getVaccine, findVaccine };
