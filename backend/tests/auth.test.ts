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
    // Drop ONLY the test database name you used in .env.test (e.g., ai_crypto_tests)
    await mongoose.connection.dropDatabase();
  } catch (_) {}
  await mongoose.connection.close();
});

describe("Auth flow (JWT only)", () => {
  const u = { username: "yotam_test", email: "yotam_test@example.com", password: "Passw0rd!" };
  let accessToken = "";
  let refreshToken = "";
  let userId = "";

  it("registers a new user", async () => {
    const res = await request(app).post("/api/auth/register").send(u);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.username).toBe(u.username);
    expect(res.body.email).toBe(u.email);
    userId = res.body._id;
  });

  it("rejects duplicate email", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: "another_username",
      email: u.email,
      password: "abcd1234",
    });
    expect(res.status).toBe(409);
  });

  it("rejects duplicate username", async () => {
    const res = await request(app).post("/api/auth/register").send({
      username: u.username,
      email: "unique_email@example.com",
      password: "abcd1234",
    });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: u.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body).toHaveProperty("_id");
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it("fails login with wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      username: u.username,
      password: "wrong_password",
    });
    expect(res.status).toBe(400);
  });

  it("refreshes tokens with valid refreshToken", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken; // rotated
  });

  it("fetches user by id (public util route)", async () => {
    const res = await request(app).get(`/api/auth/users/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("_id", userId);
  });

  it("logs out (invalidates refresh token)", async () => {
    const res = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(res.status).toBe(200);
  });

  it("rejects refresh after logout", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(400);
  });
});
