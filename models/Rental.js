const mongoose = require("mongoose");
const { BRANCH_SLUGS } = require("../constants/branches");

const rentalSchema = new mongoose.Schema(
  {
    rentalId: { type: String, required: true, unique: true, trim: true },
    branch: { type: String, required: true, enum: BRANCH_SLUGS },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    vehicleId: { type: String, required: true },
    vehicleModel: { type: String, required: true },
    rentalRateSnapshot: { type: Number, required: true },
    rentalDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    totalCost: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

rentalSchema.index({ branch: 1, rentalDate: -1 });

module.exports = mongoose.model("Rental", rentalSchema);
