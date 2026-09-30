import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pool from "./db/index.ts";
import cloudinary from "./config/cloudinary.ts";

dotenv.config();

const app = express();
const port = 8000;

const JWT_SECRET = "rahasia-jwt-123";

app.use(cors());
app.use(express.json());

const streamerSchema = z.object({
  namast: z.string().min(1).max(50),
  kategorist: z.string().min(1).max(50),
  subscriber: z.coerce.number().int().min(0),
  views: z.coerce.number().int().min(0),
  image_url: z.string().url(),
});

const uploadToCloudinary = async (imageUrl: string): Promise<string> => {
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: "streamers",
  });

  return result.secure_url;
};

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== "admin" || password !== "12345") {
    return res.status(401).json({
      message: "Username atau password salah",
    });
  }

  const token = jwt.sign(
    {
      username: username,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    },
  );

  res.json({
    message: "Login berhasil",
    token: token,
  });
});

app.get("/api/streamers", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM streamers");

    res.json({
      message: "Berhasil mengambil data streamer",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil data streamer",
    });
  }
});

app.post("/api/streamers", async (req, res) => {
  try {
    const validation = streamerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Data tidak valid",
        error: validation.error.issues,
      });
    }

    const { namast, kategorist, subscriber, views, image_url } =
      validation.data;

    const cloudinaryUrl = await uploadToCloudinary(image_url);

    await pool.query(
      `INSERT INTO streamers
      (namast, kategorist, subscriber, views, image_url)
      VALUES (?, ?, ?, ?, ?)`,
      [namast, kategorist, subscriber, views, cloudinaryUrl],
    );

    res.status(201).json({
      message: "Berhasil menambahkan streamer",
      data: {
        namast,
        kategorist,
        subscriber,
        views,
        image_url: cloudinaryUrl,
      },
    });
  } catch (error) {
    console.error("ERROR POST STREAMER:", error);

    res.status(500).json({
      message: "Gagal menambahkan streamer",
      error: error instanceof Error ? error.message : error,
    });
  }
});

app.put("/api/streamers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const validation = streamerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Data tidak valid",
        error: validation.error.issues,
      });
    }

    const { namast, kategorist, subscriber, views, image_url } =
      validation.data;

    const cloudinaryUrl = await uploadToCloudinary(image_url);

    const [result]: any = await pool.query(
      `UPDATE streamers
      SET namast = ?,
          kategorist = ?,
          subscriber = ?,
          views = ?,
          image_url = ?
      WHERE id = ?`,
      [namast, kategorist, subscriber, views, cloudinaryUrl, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Streamer tidak ditemukan",
      });
    }

    res.json({
      message: "Berhasil mengubah streamer",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengubah streamer",
    });
  }
});

app.delete("/api/streamers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [result]: any = await pool.query(
      "DELETE FROM streamers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Streamer tidak ditemukan",
      });
    }

    res.json({
      message: "Berhasil menghapus streamer",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal menghapus streamer",
    });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
