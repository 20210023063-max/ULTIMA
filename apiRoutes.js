const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const User = require("./models/User");
const Vehicle = require("./models/Vehicle");
const Customer = require("./models/Customer");
const Rental = require("./models/Rental");
const Inquiry = require("./models/Inquiry");
const { BRANCHES, isValidBranch } = require("./constants/branches");
const { authMiddleware, requirePortalAdmin } = require("./middleware/auth");
const { buildInvoice, rentalDaysInclusive } = require("./lib/invoice");

const router = express.Router();

function assertBranch(req, res, branch) {
  if (!branch || !isValidBranch(branch)) {
    res.status(400).json({ error: "Invalid branch." });
    return false;
  }
  if (req.user && req.user.branch !== branch) {
    res.status(403).json({ error: "You can only access your branch." });
    return false;
  }
  return true;
}

// --- Public ---
router.get("/branches", (_req, res) => {
  res.json({
    branches: Object.entries(BRANCHES).map(([slug, name]) => ({ slug, name })),
  });
});

router.get("/stats", async (req, res) => {
  const branch = String(req.query.branch || "").toLowerCase();
  if (!assertBranch({ user: null }, res, branch)) return;

  const [available, rented, maintenance, rentalCount] = await Promise.all([
    Vehicle.countDocuments({ branch, status: "Available" }),
    Vehicle.countDocuments({ branch, status: "Rented" }),
    Vehicle.countDocuments({ branch, status: "Maintenance" }),
    Rental.countDocuments({ branch }),
  ]);

  res.json({
    branch,
    branchName: BRANCHES[branch],
    vehicles: { available, rented, maintenance, total: available + rented + maintenance },
    rentalRecords: rentalCount,
  });
});

router.get("/vehicles", async (req, res) => {
  const branch = String(req.query.branch || "").toLowerCase();
  if (!assertBranch({ user: null }, res, branch)) return;
  const list = await Vehicle.find({ branch }).sort({ vehicleId: 1 }).lean();
  res.json(list);
});

router.post("/inquiries", async (req, res) => {
  const branch = String(req.body.branch || "").toLowerCase();
  if (!branch || !isValidBranch(branch)) {
    return res.status(400).json({ error: "Valid branch required." });
  }
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const carModel = String(req.body.carModel || "").trim();
  const { startDate: startRaw, endDate: endRaw } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required." });
  }
  let startDate;
  let endDate;
  if (startRaw) {
    startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) return res.status(400).json({ error: "Invalid start date." });
  }
  if (endRaw) {
    endDate = new Date(endRaw);
    if (Number.isNaN(endDate.getTime())) return res.status(400).json({ error: "Invalid end date." });
  }
  if (startDate && endDate && endDate < startDate) {
    return res.status(400).json({ error: "End date must be on or after start date." });
  }
  const doc = await Inquiry.create({
    branch,
    name,
    phone,
    carModel,
    startDate,
    endDate,
  });
  res.status(201).json({ id: doc._id, ok: true });
});

router.get("/rentals", authMiddleware, async (req, res) => {
  const branch = String(req.query.branch || req.user.branch).toLowerCase();
  if (!assertBranch(req, res, branch)) return;
  const list = await Rental.find({ branch })
    .sort({ rentalDate: -1 })
    .select(
      "rentalId customerId vehicleId rentalDate returnDate totalCost paymentStatus vehicleModel customerName customerEmail"
    )
    .lean();
  const isStaffViewer = req.user.role === "branch_staff";
  if (isStaffViewer) {
    for (const row of list) delete row.customerEmail;
  }
  res.json(list);
});

// --- Auth ---
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }
  const user = await User.findOne({ username: String(username).trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const role = user.role === "branch_staff" ? "branch_staff" : "branch_admin";
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      branch: user.branch,
      role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  res.json({
    token,
    user: {
      username: user.username,
      branch: user.branch,
      branchName: BRANCHES[user.branch],
      role,
      roleLabel: role === "branch_staff" ? "Viewer (staff)" : "Administrator",
    },
  });
});

router.get("/auth/me", authMiddleware, (req, res) => {
  const role = req.user.role === "branch_staff" ? "branch_staff" : "branch_admin";
  res.json({
    username: req.user.username,
    branch: req.user.branch,
    branchName: BRANCHES[req.user.branch],
    role,
    roleLabel: role === "branch_staff" ? "Viewer (staff)" : "Administrator",
  });
});

// --- Authenticated ---
router.get("/customers", authMiddleware, requirePortalAdmin, async (req, res) => {
  const branch = String(req.query.branch || req.user.branch).toLowerCase();
  if (!assertBranch(req, res, branch)) return;
  const list = await Customer.find({ branch }).sort({ customerId: 1 }).lean();
  res.json(list);
});

router.post("/customers", authMiddleware, requirePortalAdmin, async (req, res) => {
  const branch = String(req.body.branch || req.user.branch).toLowerCase();
  if (!assertBranch(req, res, branch)) return;
  const { customerId, name, email } = req.body;
  if (!customerId || !name || !email) {
    return res.status(400).json({ error: "customerId, name, and email required." });
  }
  try {
    const doc = await Customer.create({
      customerId: String(customerId).trim(),
      branch,
      name: String(name).trim(),
      email: String(email).trim(),
    });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "Customer ID already exists for this branch." });
    res.status(500).json({ error: "Could not create customer." });
  }
});

router.post("/vehicles", authMiddleware, requirePortalAdmin, async (req, res) => {
  const branch = String(req.body.branch || req.user.branch).toLowerCase();
  if (!assertBranch(req, res, branch)) return;
  const { vehicleId, model, rentalRate } = req.body;
  const rate = Number(rentalRate);
  if (!vehicleId || !model || !Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: "vehicleId, model, and positive rentalRate required." });
  }
  try {
    const doc = await Vehicle.create({
      vehicleId: String(vehicleId).trim(),
      branch,
      model: String(model).trim(),
      rentalRate: rate,
      status: "Available",
    });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({ error: "Vehicle ID already exists for this branch." });
    res.status(500).json({ error: "Could not create vehicle." });
  }
});

router.patch("/vehicles/:vehicleId/rate", authMiddleware, requirePortalAdmin, async (req, res) => {
  const vehicleId = String(req.params.vehicleId || "").trim();
  const rate = Number(req.body?.rentalRate);
  if (!vehicleId || !Number.isFinite(rate) || rate <= 0) {
    return res.status(400).json({ error: "Valid vehicleId and positive rentalRate required." });
  }

  const vehicle = await Vehicle.findOne({
    branch: req.user.branch,
    vehicleId,
  });
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found in this branch." });

  vehicle.rentalRate = rate;
  await vehicle.save();
  res.json({
    ok: true,
    vehicleId: vehicle.vehicleId,
    rentalRate: vehicle.rentalRate,
  });
});

router.post("/rentals", authMiddleware, requirePortalAdmin, async (req, res) => {
  const branch = String(req.body.branch || req.user.branch).toLowerCase();
  if (!assertBranch(req, res, branch)) return;
  const { customerId, vehicleId, rentalDate, returnDate } = req.body;
  if (!customerId || !vehicleId || !rentalDate || !returnDate) {
    return res.status(400).json({ error: "customerId, vehicleId, rentalDate, returnDate required." });
  }
  const rDate = new Date(rentalDate);
  const uDate = new Date(returnDate);
  if (Number.isNaN(rDate.getTime()) || Number.isNaN(uDate.getTime())) {
    return res.status(400).json({ error: "Invalid dates. Use yyyy-MM-dd." });
  }
  if (uDate < rDate) {
    return res.status(400).json({ error: "Return date must be on or after rental date." });
  }

  const customer = await Customer.findOne({ branch, customerId: String(customerId).trim() });
  if (!customer) return res.status(404).json({ error: "Customer not found in this branch." });

  const vehicle = await Vehicle.findOne({ branch, vehicleId: String(vehicleId).trim() });
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found in this branch." });
  if (vehicle.status !== "Available") {
    return res.status(400).json({ error: "Vehicle is not available for rent." });
  }

  const days = rentalDaysInclusive(rDate, uDate);
  const totalCost = vehicle.rentalRate * days;
  const rentalId = `RENT-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  vehicle.status = "Rented";
  await vehicle.save();

  const rental = await Rental.create({
    rentalId,
    branch,
    customerId: customer.customerId,
    customerName: customer.name,
    customerEmail: customer.email,
    vehicleId: vehicle.vehicleId,
    vehicleModel: vehicle.model,
    rentalRateSnapshot: vehicle.rentalRate,
    rentalDate: rDate,
    returnDate: uDate,
    totalCost,
    paymentStatus: "pending",
  });

  res.status(201).json(rental);
});

router.patch("/rentals/:rentalId/return", authMiddleware, requirePortalAdmin, async (req, res) => {
  const { rentalId } = req.params;
  const rental = await Rental.findOne({ rentalId });
  if (!rental || rental.branch !== req.user.branch) {
    return res.status(404).json({ error: "Rental not found." });
  }
  const vehicle = await Vehicle.findOne({ branch: rental.branch, vehicleId: rental.vehicleId });
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
  if (vehicle.status === "Available") {
    return res.status(400).json({ error: "Vehicle already marked available." });
  }
  vehicle.status = "Available";
  await vehicle.save();
  res.json({ ok: true, vehicleId: vehicle.vehicleId });
});

router.patch("/rentals/:rentalId/payment", authMiddleware, requirePortalAdmin, async (req, res) => {
  const { rentalId } = req.params;
  const status = req.body.paymentStatus === "paid" ? "paid" : "pending";
  const rental = await Rental.findOne({ rentalId });
  if (!rental || rental.branch !== req.user.branch) {
    return res.status(404).json({ error: "Rental not found." });
  }
  rental.paymentStatus = status;
  rental.paidAt = status === "paid" ? new Date() : null;
  await rental.save();
  res.json(rental);
});

router.get("/rentals/:rentalId/invoice", authMiddleware, requirePortalAdmin, async (req, res) => {
  const { rentalId } = req.params;
  const rental = await Rental.findOne({ rentalId });
  if (!rental || rental.branch !== req.user.branch) {
    return res.status(404).json({ error: "Rental not found." });
  }
  res.json(buildInvoice(rental.toObject()));
});

module.exports = router;
