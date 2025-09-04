import { NextFunction, Request, Response, RequestHandler } from "express";
import userModel from "../models/users_model";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions, JwtPayload, VerifyErrors } from "jsonwebtoken";

/** ----------------------------------------------------------------
 * Token helpers
 * ---------------------------------------------------------------- */
export const generateTokens = (
  _id: string
): { accessToken: string; refreshToken: string } | null => {
  const JWT_SECRET: Secret | undefined = process.env.TOKEN_SECRET as Secret | undefined;

  const ACCESS_TOKEN_EXPIRES: SignOptions["expiresIn"] =
    (process.env.TOKEN_EXPIRES as SignOptions["expiresIn"]) || "15m";
  const REFRESH_TOKEN_EXPIRES: SignOptions["expiresIn"] =
    (process.env.REFRESH_TOKEN_EXPIRES as SignOptions["expiresIn"]) || "7d";

  if (!JWT_SECRET) {
    console.error("Missing TOKEN_SECRET in .env file");
    return null;
  }

  const random = Math.floor(Math.random() * 1_000_000);

  const accessToken = jwt.sign({ _id, random }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshToken = jwt.sign({ _id, random }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  return { accessToken, refreshToken };
};

type Payload = JwtPayload & { _id: string };

function assertPayload(decoded: JwtPayload | string | undefined): decoded is Payload {
  return typeof decoded === "object" && decoded !== null && "_id" in decoded;
}

/** ----------------------- Register ----------------------- */
const register: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password) {
      res.status(400).json({ message: "username, email and password are required." });
      return;
    }

    const [existingUsername, existingEmail] = await Promise.all([
      userModel.findOne({ username }),
      userModel.findOne({ email }),
    ]);
    if (existingUsername) {
      res.status(409).json({ message: "Username is already taken." });
      return;
    }
    if (existingEmail) {
      res.status(409).json({ message: "Email is already taken." });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await userModel.create({
      username,
      email,
      password: hashedPassword,
      onboarding: { completed: false, assets: [], investorType: "", contentPrefs: [] },
    });

    res.status(201).json({
      _id: user.id,
      username: user.username,
      email: user.email,
      needsOnboarding: true,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Internal server error", error: err });
  }
};

/** ------------------------- Login ------------------------ */
const login: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).send("username and password are required");
      return;
    }

    const user = await userModel.findOne({ username }).exec();
    if (!user) {
      res.status(400).send("bad info");
      return;
    }

    // Narrowing – וודא שקיים שדה סיסמה
    if (!user.password) {
      res.status(500).send("User has no password stored");
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(400).send("bad info");
      return;
    }

    const tokens = generateTokens(user.id);
    if (!tokens) {
      res.status(400).send("couldn't generate tokens");
      return;
    }

    if (!Array.isArray(user.refreshTokens)) user.refreshTokens = [];
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    const needsOnboarding = !user.onboarding?.completed;

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      _id: user.id,
      needsOnboarding,
      onboarding: user.onboarding ?? null,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).send(err);
  }
};

/** ------------------------- Logout ----------------------- */
const logout: RequestHandler = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).send("no token");
    return;
  }

  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  if (!TOKEN_SECRET) {
    res.status(400).send("no token secret");
    return;
  }

  jwt.verify(
    refreshToken,
    TOKEN_SECRET as Secret,
    async (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        res.status(400).send("invalid token");
        return;
      }
      try {
        if (!assertPayload(decoded)) {
          res.status(400).send("invalid token");
          return;
        }
        const user = await userModel.findById(decoded._id).exec();
        if (!user) {
          res.status(400).send("no id");
          return;
        }

        if (!Array.isArray(user.refreshTokens)) user.refreshTokens = [];
        user.refreshTokens = user.refreshTokens.filter((t: string) => t !== refreshToken);
        await user.save();

        res.status(200).send("logged out");
      } catch (e) {
        console.error("Logout error:", e);
        res.status(400).send(e);
      }
    }
  );
};

/** ------------------------- Refresh ---------------------- */
const refresh: RequestHandler = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).send("bad token");
    return;
  }
  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  if (!TOKEN_SECRET) {
    res.status(400).send("bad token");
    return;
  }

  jwt.verify(
    refreshToken,
    TOKEN_SECRET as Secret,
    async (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        res.status(400).send("bad token");
        return;
      }
      try {
        if (!assertPayload(decoded)) {
          res.status(400).send("bad token");
          return;
        }

        const user = await userModel.findById(decoded._id).exec();
        if (!user) {
          res.status(400).send("bad token");
          return;
        }

        if (!Array.isArray(user.refreshTokens) || !user.refreshTokens.includes(refreshToken)) {
          user.refreshTokens = [];
          await user.save();
          res.status(400).send("bad token");
          return;
        }

        const newTokens = generateTokens(user.id);
        if (!newTokens) {
          user.refreshTokens = [];
          await user.save();
          res.status(400).send("bad token");
          return;
        }

        user.refreshTokens = user.refreshTokens.filter((t: string) => t !== refreshToken);
        user.refreshTokens.push(newTokens.refreshToken);
        await user.save();

        res.status(200).json({
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        });
      } catch (e) {
        console.error("Refresh error:", e);
        res.status(400).send(e);
      }
    }
  );
};

/** --------------------- Middleware ----------------------- */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.header("authorization");
  const token = authorization && authorization.split(" ")[1];
  if (!token) {
    res.status(401).send("Access denied");
    return;
  }
  const TOKEN_SECRET = process.env.TOKEN_SECRET;
  if (!TOKEN_SECRET) {
    res.status(500).send("BAD SECRET");
    return;
  }

  jwt.verify(
    token,
    TOKEN_SECRET as Secret,
    (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        res.status(401).send("Access denied");
        return;
      }
      if (!assertPayload(decoded)) {
        res.status(401).send("Access denied");
        return;
      }
      req.params.userId = decoded._id;
      next();
    }
  );
};

/** ---------------------- Utilities ----------------------- */
const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await userModel.findById(req.params.id).select("-password -refreshTokens").exec();
    if (!user) {
      res.status(404).send("User not found");
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).send("Internal server error");
  }
};

const getUserByUsername = async (req: Request, res: Response) => {
  try {
    const user = await userModel
      .find({ username: req.query.username })
      .select("-password -refreshTokens")
      .exec();
    if (!user || user.length === 0) {
      res.status(404).send("User not found");
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).send("Internal server error");
  }
};

const updateUser: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body.user as { _id: string; username: string; email: string; password?: string };
    const existingUser = await userModel.findById(data._id).exec();
    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (data.username !== existingUser.username) {
      const usernameTaken = await userModel.findOne({ username: data.username }).exec();
      if (usernameTaken) {
        res.status(409).json({ message: "Username is already taken." });
        return;
      }
    }

    if (data.email !== existingUser.email) {
      const emailTaken = await userModel.findOne({ email: data.email }).exec();
      if (emailTaken) {
        res.status(409).json({ message: "Email is already taken." });
        return;
      }
    }

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      existingUser.password = await bcrypt.hash(data.password, salt);
    }

    existingUser.username = data.username;
    existingUser.email = data.email;

    await existingUser.save();
    res.status(200).json({ message: "User updated successfully." });
  } catch (err) {
    res.status(500).json({ message: "Internal server error", error: err });
  }
};

export default {
  updateUser,
  getUserByUsername,
  register,
  login,
  logout,
  getUserById,
  refresh,
};
