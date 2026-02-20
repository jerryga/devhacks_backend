import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET is not configured" });
    }

    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
