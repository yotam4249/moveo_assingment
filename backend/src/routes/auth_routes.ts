import express from "express";
import authController, { authMiddleware } from "../controllers/auth_controller";

const router = express.Router();

// Public
router.post("/register", authController.register);
router.post("/login", authController.login);

// Token maintenance
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Users (examples you had)
router.get("/users/:id", authController.getUserById);
router.get("/username", authController.getUserByUsername);
router.put("/userUpdate", authController.updateUser);

// Example protected route using access token (optional)
// router.get("/me", authMiddleware, (req, res) => {
//   res.json({ userId: req.params.userId });
// });

export default router;
