/* eslint-disable react-refresh/only-export-components */
// src/react/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import type { JSX } from "react/jsx-runtime";

function hasToken() {
  return !!localStorage.getItem("token");
}

function Protected({ element }: { element: JSX.Element }) {
  return hasToken() ? element : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  { path: "/onboarding", element: <Protected element={<div className="container"><div className="card">Onboarding TODO</div></div>} /> },
  { path: "/dashboard", element: <Protected element={<div className="container"><div className="card">Dashboard TODO</div></div>} /> },

  { path: "*", element: <Navigate to="/login" replace /> },
]);
