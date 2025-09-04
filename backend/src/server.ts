import express, { Express, NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import api from "./routes";

dotenv.config({ quiet: true });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: "GET,POST,PUT,DELETE,PATCH",
    allowedHeaders: "Content-Type,Authorization",
  })
);
app.use(cookieParser());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://accounts.google.com"
  );
  next();
});

app.get("/health", (_req, res) => res.send("OK"));
app.use("/api", api); 

/** ---------- initApp (Mongo + Express) ---------- */
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL;

const initApp = () => {
  return new Promise<Express>((resolve, reject) => {
    if (!MONGO_URI) {
      console.error("MONGO_URI (or DATABASE_URL) is not set in .env");
      return reject(new Error("Missing MONGO_URI"));
    }

    const db = mongoose.connection;
    db.on("error", (err) => console.error("Mongo error:", err));
    db.once("open", () => console.log("Connected to MongoDB"));

    mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      } as any)
      .then(() => resolve(app))
      .catch((err) => reject(err));
  });
};

export default initApp;
