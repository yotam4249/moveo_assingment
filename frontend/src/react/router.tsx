// src/react/router.tsx
/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import OnBoarding from "./pages/OnBoarding";
import Dashboard from "./pages/Dashboard"; // ✅ import the real dashboard
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

  { path: "/onboarding", element: <Protected element={<OnBoarding />} /> },

  // ✅ use the actual Dashboard component (no placeholder)
  { path: "/dashboard", element: <Protected element={<Dashboard />} /> },

  { path: "*", element: <Navigate to="/login" replace /> },
]);
