import request from "supertest";
import mongoose from "mongoose";
import initApp from "../src/server";

let app: any;

beforeAll(async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing (check .env.test)");
  app = await initApp();
});

afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase(); // drop ONLY your test DB
  } catch (_) {}
  await mongoose.connection.close();
});

describe("Onboarding flow (first login gating + editable preferences)", () => {
  // Use a unique user per run
  const ts = Date.now();
  const u = {
    username: `tester_${ts}`,
    email: `tester_${ts}@example.com`,
    password: "Passw0rd!",
  };

  let userId = "";
  let accessToken = "";
  let refreshToken = "";

  const firstPrefs = {
    assets: ["BTC", "ETH", "SOL"],
    investorType: "HODLer",
    contentPrefs: ["Market News", "Charts", "Fun"],
  };

  const updatedPrefs = {
    assets: ["DOGE", "TON"],
    investorType: "Day Trader",
    contentPrefs: ["Charts", "Social"],
  };

  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send(u);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    userId = res.body._id;
    expect(res.body.needsOnboarding).toBe(true);
  });

  it("first login returns needsOnboarding=true", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: u.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body).toHaveProperty("_id", userId);
    expect(res.body.needsOnboarding).toBe(true); // <-- gating on first login

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("GET /api/onboarding/status shows incomplete before submit", async () => {
    const res = await request(app)
      .get("/api/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
    expect(res.body.onboarding).toBeDefined();
  });

  it("POST /api/onboarding saves preferences and marks completed", async () => {
    const res = await request(app)
      .post("/api/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(firstPrefs);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Onboarding saved");
    expect(res.body.onboarding.completed).toBe(true);
    expect(res.body.onboarding.assets).toEqual(firstPrefs.assets);
    expect(res.body.onboarding.investorType).toBe(firstPrefs.investorType);
    expect(res.body.onboarding.contentPrefs).toEqual(firstPrefs.contentPrefs);
  });

  it("second login returns needsOnboarding=false", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: u.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.needsOnboarding).toBe(false);
    // update tokens for subsequent requests
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("third login also returns needsOnboarding=false (multiple logins)", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: u.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.needsOnboarding).toBe(false);
  });

  it("GET /api/onboarding/status shows completed after submit", async () => {
    const res = await request(app)
      .get("/api/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body.onboarding.assets).toEqual(firstPrefs.assets);
    expect(res.body.onboarding.investorType).toBe(firstPrefs.investorType);
    expect(res.body.onboarding.contentPrefs).toEqual(firstPrefs.contentPrefs);
  });

  it("POST /api/onboarding again updates preferences (edit allowed)", async () => {
    const res = await request(app)
      .post("/api/onboarding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(updatedPrefs);

    expect(res.status).toBe(200);
    expect(res.body.onboarding.completed).toBe(true);
    expect(res.body.onboarding.assets).toEqual(updatedPrefs.assets);
    expect(res.body.onboarding.investorType).toBe(updatedPrefs.investorType);
    expect(res.body.onboarding.contentPrefs).toEqual(updatedPrefs.contentPrefs);
  });

  it("login after editing still returns needsOnboarding=false", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: u.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.needsOnboarding).toBe(false);
  });
});
