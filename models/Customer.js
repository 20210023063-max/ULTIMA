const mongoose = require("mongoose");
const { BRANCH_SLUGS } = require("../constants/branches");

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, trim: true },
    branch: { type: String, required: true, enum: BRANCH_SLUGS },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

customerSchema.index({ branch: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);
