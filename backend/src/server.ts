// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Express, NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import api from "./routes";

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === "production";

const app = express();

/* --- Proxy + security --- */
app.set("trust proxy", true); // respect x-forwarded-* from Render/Railway

app.use(
  helmet({
    contentSecurityPolicy: false, // we'll set a minimal CSP below
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* --- CORS: allow only known frontends --- */
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const devOrigins = ["http://localhost:5173", "http://localhost:3000"];
const allowedOrigins =
  FRONTEND_ORIGIN.length ? FRONTEND_ORIGIN : isProd ? [] : devOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/server-to-server
      return allowedOrigins.includes(origin)
        ? cb(null, true)
        : cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

/* --- Remove the wildcard header block ---
   (These conflict with CORS + credentials and weaken security)
*/

/* --- Optional: redirect to HTTPS in prod --- */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isProd && req.get("x-forwarded-proto") !== "https") {
    const host = req.get("host");
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

/* --- Minimal CSP (expand as needed) --- */
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "img-src 'self' data:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "frame-ancestors 'self' https://accounts.google.com",
    ].join("; ")
  );
  // If you truly need COOP/COEP, re-add them *only if required*
  next();
});

/* --- Health + routes --- */
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.use("/api", api);

/* --- initApp (Mongo + app) --- */
const initApp = () =>
  new Promise<Express>((resolve, reject) => {
    if (!MONGO_URI) {
      console.error("MONGO_URI (or DATABASE_URL) is not set");
      return reject(new Error("Missing MONGO_URI"));
    }

    const db = mongoose.connection;
    db.on("error", (err) => console.error("[mongo] error:", err));
    db.once("open", () => console.log("✅ Connected to MongoDB"));

    mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
      } as any)
      .then(() => resolve(app))
      .catch(reject);
  });

export default initApp;
