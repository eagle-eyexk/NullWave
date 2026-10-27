import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export type AuthenticatedRequest = Request & { userId: string };

export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;

  if (typeof userId !== "string" || userId.length === 0) {
    res.status(401).json({ error: "Authentication is required." });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
};
