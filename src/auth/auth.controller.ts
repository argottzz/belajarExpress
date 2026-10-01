import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pool from "../db/index.ts";
import { loginSchema, registerSchema } from "../validations/authValidation.ts";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET ?? "rahasia-jwt-123";

export class AuthController {
  register = async (req: Request, res: Response) => {
    try {
      const validation = registerSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const { username, email, password } = validation.data;

      const [existing]: any = await pool.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email Sudah Ada",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result]: any = await pool.query(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword],
      );

      const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, {
        expiresIn: "1h",
      });

      return res.status(201).json({
        success: true,
        message: "Register berhasil",
        data: { id: result.insertId, username, email },
        token,
      });
    } catch (error) {
      console.error("ERROR REGISTER:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal register",
      });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const { email, password } = validation.data;

      const [rows]: any = await pool.query(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [email],
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Email atau password salah",
        });
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Email atau password salah",
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      return res.json({
        success: true,
        message: "Login berhasil",
        token,
        data: { id: user.id, username: user.username, email: user.email },
      });
    } catch (error) {
      console.error("ERROR LOGIN:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal login",
      });
    }
  };
}

export default new AuthController();
