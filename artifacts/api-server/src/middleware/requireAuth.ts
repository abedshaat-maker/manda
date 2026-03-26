import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (session?.userId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorised" });
  }
}
