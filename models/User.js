const mongoose = require("mongoose");
const { BRANCH_SLUGS } = require("../constants/branches");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    branch: { type: String, required: true, enum: BRANCH_SLUGS },
    role: {
      type: String,
      default: "branch_admin",
      enum: ["branch_admin", "branch_staff"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
