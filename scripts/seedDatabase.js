/**
 * Inserts branch admins, sample vehicles, customers, and optional rentals into MongoDB.
 * Run: npm run seed   (MongoDB must be running; set MONGODB_URI in .env)
 * Can also be imported: require('./scripts/seedDatabase').runSeed({ disconnectAfter: false })
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");
const Customer = require("../models/Customer");
const Rental = require("../models/Rental");
const { BRANCH_SLUGS, BRANCHES } = require("../constants/branches");

const DEFAULT_URI = "mongodb://127.0.0.1:27017/car_rental";

const sampleVehicles = [
  ["VEH001", "Toyota Camry", 50],
  ["VEH002", "Honda Accord", 45],
  ["VEH003", "Ford Mustang", 75],
];

const sampleCustomers = [
  ["CUST001", "John Doe", "john@example.com"],
  ["CUST002", "Jane Smith", "jane@example.com"],
];

/**
 * @param {{ disconnectAfter?: boolean }} opts
 */
async function runSeed(opts = {}) {
  const { disconnectAfter = true } = opts;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "branch123";

  const useExistingConnection = mongoose.connection.readyState === 1;
  if (!useExistingConnection) {
    const uri = process.env.MONGODB_URI || DEFAULT_URI;
    await mongoose.connect(uri);
    console.log("Connected:", uri.replace(/:\/\/.*@/, "://***@"));
  }

  const hash = await bcrypt.hash(adminPassword, 10);

  for (const branch of BRANCH_SLUGS) {
    const username = `admin_${branch}`;
    await User.findOneAndUpdate(
      { username },
      {
        username,
        passwordHash: hash,
        branch,
        role: "branch_admin",
      },
      { upsert: true, new: true }
    );
    console.log(`Admin ${username} / password: ${adminPassword} (${BRANCHES[branch]})`);

    const staffName = `staff_${branch}`;
    await User.findOneAndUpdate(
      { username: staffName },
      {
        username: staffName,
        passwordHash: hash,
        branch,
        role: "branch_staff",
      },
      { upsert: true, new: true }
    );
    console.log(`Viewer ${staffName} / password: ${adminPassword} — fleet & rentals view only (${BRANCHES[branch]})`);

    for (const [vehicleId, model, rate] of sampleVehicles) {
      await Vehicle.findOneAndUpdate(
        { branch, vehicleId },
        {
          branch,
          vehicleId,
          model,
          rentalRate: rate,
          status: "Available",
        },
        { upsert: true, new: true }
      );
    }

    for (const [customerId, name, email] of sampleCustomers) {
      await Customer.findOneAndUpdate(
        { branch, customerId },
        { branch, customerId, name, email },
        { upsert: true, new: true }
      );
    }
  }

  console.log("Sample vehicles and customers inserted for each branch.");

  const carmenBranch = BRANCH_SLUGS[0]; // carmen
  const sampleRentalId = "RENT-SEED001";
  const existing = await Rental.findOne({ rentalId: sampleRentalId });
  if (!existing) {
    const cust = await Customer.findOne({ branch: carmenBranch, customerId: "CUST001" });
    const veh = await Vehicle.findOne({ branch: carmenBranch, vehicleId: "VEH001" });
    if (cust && veh) {
      const rentalDate = new Date();
      rentalDate.setHours(0, 0, 0, 0);
      const returnDate = new Date(rentalDate);
      returnDate.setDate(returnDate.getDate() + 4);
      veh.status = "Rented";
      await veh.save();

      await Rental.create({
        rentalId: sampleRentalId,
        branch: carmenBranch,
        customerId: cust.customerId,
        customerName: cust.name,
        customerEmail: cust.email,
        vehicleId: veh.vehicleId,
        vehicleModel: veh.model,
        rentalRateSnapshot: veh.rentalRate,
        rentalDate,
        returnDate,
        totalCost: veh.rentalRate * 5,
        paymentStatus: "pending",
      });
      console.log("Demo rental added for Carmen branch (VEH001 marked Rented).");
    }
  } else {
    console.log("Demo rental already present; skipping sample rental.");
  }

  if (disconnectAfter) await mongoose.disconnect();
  console.log("Seed complete.");
}

module.exports = { runSeed };

if (require.main === module) {
  runSeed({ disconnectAfter: true }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
