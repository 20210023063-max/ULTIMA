const mongoose = require("mongoose");
const { BRANCH_SLUGS } = require("../constants/branches");

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true, trim: true },
    branch: { type: String, required: true, enum: BRANCH_SLUGS },
    model: { type: String, required: true, trim: true },
    rentalRate: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["Available", "Rented", "Maintenance"],
      default: "Available",
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ branch: 1, vehicleId: 1 }, { unique: true });

module.exports = mongoose.model("Vehicle", vehicleSchema);
