/** Store branches (normalized slug → display label) */
module.exports.BRANCHES = {
  carmen: "Carmen",
  gusa: "Gusa",
  iponan: "Iponan",
  bugo: "Bugo",
};

module.exports.BRANCH_SLUGS = Object.keys(module.exports.BRANCHES);

module.exports.isValidBranch = (slug) =>
  Object.prototype.hasOwnProperty.call(module.exports.BRANCHES, slug);
