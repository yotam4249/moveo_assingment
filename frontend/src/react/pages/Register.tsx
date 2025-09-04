/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import userService from "../../services/user_service";
import "../../css/Register.css";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    try {
      await userService.register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      navigate("/login");
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" role="region" aria-labelledby="register-title">
        <h1 id="register-title" className="auth-title">Create your account</h1>
        <p className="auth-sub">Join the personalized crypto dashboard</p>

        <form className="form-grid" onSubmit={onSubmit}>
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
            <span className="sr-only">Email</span>
            <input
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              required
            />
          </label>

          {err && <div className="error" role="alert">{err}</div>}

          <button className="btn" type="submit">Create account</button>
        </form>

        <div className="row">
          <span className="auth-sub">Already have an account?</span>
          <Link className="link" to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
