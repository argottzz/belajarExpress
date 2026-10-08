import type { NextFunction, Request, Response } from "express";

export function adminMiddleware(
  req: any,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Akses ditolak. Hanya admin.",
    });
  }

  next();
}