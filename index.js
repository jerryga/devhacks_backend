import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { authRoutes } from "./routers/authRoutes.js";
import { userRoutes } from "./routers/userRoutes.js";
import { vaccineRoutes } from "./routers/vaccineRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/vaccine", vaccineRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
