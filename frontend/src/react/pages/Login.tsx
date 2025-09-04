/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import userService from "../../services/user_service";
import "../../css/login.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    try {
      const data = await userService.logIn({ username: username.trim(), password });
      // data has: accessToken, refreshToken, _id, needsOnboarding, onboarding?
      navigate(data.needsOnboarding ? "/onboarding" : "/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" role="region" aria-labelledby="login-title">
        <h1 id="login-title" className="auth-title">Welcome back</h1>
        <p className="auth-sub">Log in to your crypto dashboard</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            <span className="sr-only">Username</span>
            <input
              className="input"
              placeholder="Username"
              value={username}
              onChange={(e)=>setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span className="sr-only">Password</span>
            <input
              className="input"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {err && <div className="error" role="alert">{err}</div>}

          <button className="btn" type="submit">Login</button>
        </form>

        <div className="row">
          <span className="auth-sub">No account?</span>
          <Link className="link" to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
