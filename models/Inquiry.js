const mongoose = require("mongoose");
const { BRANCH_SLUGS } = require("../constants/branches");

const inquirySchema = new mongoose.Schema(
  {
    branch: { type: String, required: true, enum: BRANCH_SLUGS },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    carModel: { type: String, default: "", trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, default: "new", enum: ["new", "contacted", "closed"] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inquiry", inquirySchema);
