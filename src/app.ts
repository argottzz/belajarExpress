import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { z } from "zod";
import pool from "./db/index.ts";
import cloudinary from "./config/cloudinary.ts";
import authController from "./auth/auth.controller.ts";
import { verifyToken } from "./middleware/auth.ts";
import upload from "./middleware/upload.ts";

dotenv.config();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const streamerSchema = z.object({
  namast: z.string().min(1).max(50),
  kategorist: z.string().min(1).max(50),
  subscriber: z.coerce.number().int().min(0),
  views: z.coerce.number().int().min(0),
});

const uploadBufferToCloudinary = async (
  buffer: Buffer,
  mimetype: string,
): Promise<{ secure_url: string; public_id: string }> => {
  const dataURI = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataURI, {
    folder: "streamers",
  });

  return { secure_url: result.secure_url, public_id: result.public_id };
};

app.post("/api/register", authController.register);
app.post("/api/login", authController.login);

app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const [rows]: any = await pool.query(
      "SELECT id, username, email FROM users WHERE id = ? LIMIT 1",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ message: "Fetch Successfully.", data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal mengambil user" });
  }
});

app.get("/api/streamers", verifyToken, async (req, res) => {
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

app.post(
  "/api/streamers",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const validation = streamerSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Gambar wajib diupload (field: image)",
        });
      }

      const { namast, kategorist, subscriber, views } = validation.data;

      const { secure_url, public_id } = await uploadBufferToCloudinary(
        req.file.buffer,
        req.file.mimetype,
      );

      await pool.query(
        `INSERT INTO streamers
      (namast, kategorist, subscriber, views, image_url, public_id)
      VALUES (?, ?, ?, ?, ?, ?)`,
        [namast, kategorist, subscriber, views, secure_url, public_id],
      );

      res.status(201).json({
        message: "Berhasil menambahkan streamer",
        data: {
          namast,
          kategorist,
          subscriber,
          views,
          image_url: secure_url,
          public_id,
        },
      });
    } catch (error) {
      console.error("ERROR POST STREAMER:", error);

      res.status(500).json({
        message: "Gagal menambahkan streamer",
        error: error instanceof Error ? error.message : error,
      });
    }
  },
);

app.put(
  "/api/streamers/:id",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const validation = streamerSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const [existing]: any = await pool.query(
        "SELECT public_id FROM streamers WHERE id = ? LIMIT 1",
        [id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "Streamer tidak ditemukan",
        });
      }

      const { namast, kategorist, subscriber, views } = validation.data;
      let image_url: string = "";
      let public_id: string | null = existing[0].public_id ?? null;

      // Kalau ada file baru, upload lalu hapus gambar lama di Cloudinary
      if (req.file) {
        const uploaded = await uploadBufferToCloudinary(
          req.file.buffer,
          req.file.mimetype,
        );
        image_url = uploaded.secure_url;
        public_id = uploaded.public_id;

        if (existing[0].public_id) {
          await cloudinary.uploader.destroy(existing[0].public_id);
        }
      } else {
        const [current]: any = await pool.query(
          "SELECT image_url FROM streamers WHERE id = ? LIMIT 1",
          [id],
        );
        image_url = current[0].image_url;
      }

      const [result]: any = await pool.query(
        `UPDATE streamers
      SET namast = ?,
          kategorist = ?,
          subscriber = ?,
          views = ?,
          image_url = ?,
          public_id = ?
      WHERE id = ?`,
        [namast, kategorist, subscriber, views, image_url, public_id, id],
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
  },
);

app.delete("/api/streamers/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [existing]: any = await pool.query(
      "SELECT public_id FROM streamers WHERE id = ? LIMIT 1",
      [id],
    );

    const [result]: any = await pool.query(
      "DELETE FROM streamers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Streamer tidak ditemukan",
      });
    }

    if (existing.length > 0 && existing[0].public_id) {
      await cloudinary.uploader.destroy(existing[0].public_id);
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

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message ?? "Upload gagal" });
    }
    next();
  },
);

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
