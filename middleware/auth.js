const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token =
    header && header.startsWith("Bearer ") ? header.slice(7) : req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Login required." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

/** JWT from before roles were introduced has no role — treat as full admin access. */
function jwtPortalRole(req) {
  return req.user?.role === "branch_staff" ? "branch_staff" : "branch_admin";
}

/** Mutations: renting, returns, receipts, CRM, fleet adds */
function requirePortalAdmin(req, res, next) {
  if (jwtPortalRole(req) !== "branch_admin") {
    return res.status(403).json({ error: "Administrator access required for this action." });
  }
  next();
}

module.exports = { authMiddleware, requirePortalAdmin };
