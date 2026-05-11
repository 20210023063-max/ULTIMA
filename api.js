/**
 * Compatibility shim: some repos mistakenly put `routes/api.js` content here
 * (`require("../api")`), which crashes. Always delegate to the real router.
 */
module.exports = require("./apiRoutes");
