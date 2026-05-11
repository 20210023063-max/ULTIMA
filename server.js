require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const apiRouter = require("./apiRoutes");

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_LOCAL_URI = "mongodb://localhost:27017/car_rental";
const ALLOW_MEMORY_FALLBACK = process.env.ALLOW_MEMORY_FALLBACK === "1";

/** @returns {Promise<{ stopMemory?: () => Promise<void>; usedMemory?: boolean }>} */
async function connectMongo() {
  async function disconnectQuiet() {
    await mongoose.disconnect().catch(() => {});
  }

  const atlasOpts = { serverSelectionTimeoutMS: 25000 };
  const localOpts = { serverSelectionTimeoutMS: 12000 };
  const attempts = Number(process.env.MONGO_CONNECT_RETRIES || 5);
  const pauseMs = Number(process.env.MONGO_CONNECT_RETRY_MS || 4000);

  async function connectWithRetries(uri, opts, logLabel) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        await disconnectQuiet();
        await mongoose.connect(uri, opts);
        console.log(logLabel);
        return;
      } catch (e) {
        lastErr = e;
        console.warn(`[car-rental-web] Mongo connect attempt ${i + 1}/${attempts} failed: ${e.message}`);
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
    throw lastErr;
  }

  if (process.env.MONGODB_URI) {
    await connectWithRetries(
      process.env.MONGODB_URI,
      atlasOpts,
      "MongoDB connected via MONGODB_URI."
    );
    return {};
  }

  try {
    await mongoose.connect(DEFAULT_LOCAL_URI, localOpts);
    console.log("MongoDB connected:", DEFAULT_LOCAL_URI);
    return {};
  } catch (_) {
    await disconnectQuiet();
  }

  if (!ALLOW_MEMORY_FALLBACK) {
    throw new Error(
      "MongoDB connection failed. Set a valid MONGODB_URI (recommended) or start local MongoDB. " +
        "To use temporary in-memory data for demo/dev only, set ALLOW_MEMORY_FALLBACK=1."
    );
  }

  const { MongoMemoryServer } = require("mongodb-memory-server");
  const ms = await MongoMemoryServer.create();
  const uri = ms.getUri();
  await mongoose.connect(uri);
  console.warn(
    "[car-rental-web] Local MongoDB not reachable — using an in-memory database for this session."
  );

  await require("./scripts/seedDatabase").runSeed({ disconnectAfter: false });
  console.log("[car-rental-web] Loaded demo admins, fleet, customers, and a sample Carmen rental.");

  return {
    usedMemory: true,
    async stopMemory() {
      await mongoose.disconnect().catch(() => {});
      await ms.stop().catch(() => {});
    },
  };
}

let mongoShutdown = async () => {};

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "dev-only-change-in-env";
  console.warn("[car-rental-web] JWT_SECRET not set; using a dev default (set .env for production).");
} else if (process.env.JWT_SECRET.length < 16) {
  console.warn("[car-rental-web] JWT_SECRET should be at least 16 characters in production.");
}

const app = express();
app.use(cors());
app.use(express.json());

/** Always available — helps Render/process managers see the server is up while Mongo connects. */
app.get("/api/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    database: ready ? "connected" : "disconnected",
  });
});

app.use("/api", apiRouter);
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function main() {
  /** @type {import('http').Server} */
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[car-rental-web] Listening on 0.0.0.0:${PORT} (health: /api/health)\n   Open: http://127.0.0.1:${PORT}\n`
    );
  });

  const shutdownSignals = ["SIGINT", "SIGTERM"];
  shutdownSignals.forEach((signal) => {
    process.on(signal, () => {
      server.close(async () => {
        await mongoShutdown();
        process.exit(0);
      });
    });
  });

  try {
    const { stopMemory } = await connectMongo();
    mongoShutdown = async () => {
      if (stopMemory) await stopMemory().catch(() => {});
      await mongoose.disconnect().catch(() => {});
    };
  } catch (err) {
    console.error("[car-rental-web] MongoDB connection failed — server stays up for debugging.");
    console.error(err);
    console.error(
      "[car-rental-web] Set MONGODB_URI and JWT_SECRET on Render; allow Atlas Network Access (e.g. 0.0.0.0/0 for demos)."
    );
  }
}

main().catch(async (err) => {
  console.error(err);
  await mongoShutdown().catch(() => {});
  process.exit(1);
});
