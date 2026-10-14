import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pool from "./db/index.ts";
import cloudinary from "./config/cloudinary.ts";
import authController from "./auth/auth.controller.ts";
import { adminMiddleware } from "./middleware/adminMiddleware.ts";
import { verifyToken } from "./middleware/auth.ts";
import upload from "./middleware/upload.ts";


dotenv.config();

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const channelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional().nullable(),
  subscriber_count: z.coerce.number().int().min(0).optional().default(0),
});

const videoSchema = z.object({
  channel_id: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  duration_seconds: z.coerce.number().int().min(0).optional().default(0),
  views_count: z.coerce.number().int().min(0).optional().default(0),
  visibility: z.enum(["public", "private", "unlisted"]).optional().default("public"),
});

const uploadBufferToCloudinary = async (
  buffer: Buffer,
  mimetype: string,
  folder: string,
): Promise<{ secure_url: string; public_id: string }> => {
  const dataURI = `data:${mimetype};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataURI, {
    folder,
  });

  return { secure_url: result.secure_url, public_id: result.public_id };
};

app.post("/api/register", authController.register);
app.post("/api/login", authController.login);

app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const [rows]: any = await pool.query(
      "SELECT id, username, email, role FROM users WHERE id = ? LIMIT 1",
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

app.get("/api/channels", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.username AS owner_username
       FROM channels c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`,
    );

    res.json({
      message: "Berhasil mengambil data channel",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil data channel",
    });
  }
});

app.get("/api/channels/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID channel tidak valid",
      });
    }

    const [rows]: any = await pool.query(
      `SELECT c.*, u.username AS owner_username
       FROM channels c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ? LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Channel tidak ditemukan",
      });
    }

    const [videos] = await pool.query(
      "SELECT * FROM videos WHERE channel_id = ? ORDER BY created_at DESC",
      [id],
    );

    res.json({
      message: "Berhasil mengambil detail channel",
      data: { ...rows[0], videos },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil detail channel",
    });
  }
});

app.post(
  "/api/channels",
  verifyToken,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const validation = channelSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const userId = (req as any).user.id;
      const [owned]: any = await pool.query(
        "SELECT id FROM channels WHERE user_id = ? LIMIT 1",
        [userId],
      );

      if (owned.length > 0) {
        return res.status(400).json({
          message: "User sudah memiliki channel",
        });
      }

      const { name, description, subscriber_count } = validation.data;
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      let avatar_url: string | null = null;
      let avatar_public_id: string | null = null;
      let banner_url: string | null = null;
      let banner_public_id: string | null = null;

      if (files?.avatar?.[0]) {
        const uploaded = await uploadBufferToCloudinary(
          files.avatar[0].buffer,
          files.avatar[0].mimetype,
          "channels/avatars",
        );
        avatar_url = uploaded.secure_url;
        avatar_public_id = uploaded.public_id;
      }

      if (files?.banner?.[0]) {
        const uploaded = await uploadBufferToCloudinary(
          files.banner[0].buffer,
          files.banner[0].mimetype,
          "channels/banners",
        );
        banner_url = uploaded.secure_url;
        banner_public_id = uploaded.public_id;
      }

      const [result]: any = await pool.query(
        `INSERT INTO channels
        (user_id, name, description, avatar_url, avatar_public_id, banner_url, banner_public_id, subscriber_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          name,
          description ?? null,
          avatar_url,
          avatar_public_id,
          banner_url,
          banner_public_id,
          subscriber_count ?? 0,
        ],
      );

      res.status(201).json({
        message: "Berhasil menambahkan channel",
        data: {
          id: result.insertId,
          user_id: userId,
          name,
          description: description ?? null,
          avatar_url,
          avatar_public_id,
          banner_url,
          banner_public_id,
          subscriber_count: subscriber_count ?? 0,
        },
      });
    } catch (error) {
      console.error("ERROR POST CHANNEL:", error);

      res.status(500).json({
        message: "Gagal menambahkan channel",
        error: error instanceof Error ? error.message : error,
      });
    }
  },
);

app.put(
  "/api/channels/:id",
  verifyToken,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "ID channel tidak valid",
        });
      }

      const validation = channelSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const [existing]: any = await pool.query(
        "SELECT * FROM channels WHERE id = ? LIMIT 1",
        [id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "Channel tidak ditemukan",
        });
      }

      const requester = (req as any).user;
      const isOwner = existing[0].user_id === requester.id;
      const isAdmin = requester.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          message: "Akses ditolak. Bukan pemilik channel.",
        });
      }

      const { name, description, subscriber_count } = validation.data;
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      let avatar_url: string | null = existing[0].avatar_url;
      let avatar_public_id: string | null = existing[0].avatar_public_id;
      let banner_url: string | null = existing[0].banner_url;
      let banner_public_id: string | null = existing[0].banner_public_id;
      let old_avatar_public_id: string | null = null;
      let old_banner_public_id: string | null = null;

      if (files?.avatar?.[0]) {
        const uploaded = await uploadBufferToCloudinary(
          files.avatar[0].buffer,
          files.avatar[0].mimetype,
          "channels/avatars",
        );
        avatar_url = uploaded.secure_url;
        avatar_public_id = uploaded.public_id;
        old_avatar_public_id = existing[0].avatar_public_id ?? null;
      }

      if (files?.banner?.[0]) {
        const uploaded = await uploadBufferToCloudinary(
          files.banner[0].buffer,
          files.banner[0].mimetype,
          "channels/banners",
        );
        banner_url = uploaded.secure_url;
        banner_public_id = uploaded.public_id;
        old_banner_public_id = existing[0].banner_public_id ?? null;
      }

      const [result]: any = await pool.query(
        `UPDATE channels
        SET name = ?,
            description = ?,
            avatar_url = ?,
            avatar_public_id = ?,
            banner_url = ?,
            banner_public_id = ?,
            subscriber_count = ?
        WHERE id = ?`,
        [
          name,
          description ?? null,
          avatar_url,
          avatar_public_id,
          banner_url,
          banner_public_id,
          subscriber_count ?? existing[0].subscriber_count,
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Channel tidak ditemukan",
        });
      }

      if (old_avatar_public_id) {
        await cloudinary.uploader.destroy(old_avatar_public_id);
      }
      if (old_banner_public_id) {
        await cloudinary.uploader.destroy(old_banner_public_id);
      }

      res.json({
        message: "Berhasil mengubah channel",
        data: {
          id,
          name,
          description: description ?? null,
          avatar_url,
          avatar_public_id,
          banner_url,
          banner_public_id,
          subscriber_count: subscriber_count ?? existing[0].subscriber_count,
        },
      });
    } catch (error) {
      console.error("ERROR PUT CHANNEL:", error);

      res.status(500).json({
        message: "Gagal mengubah channel",
      });
    }
  },
);

app.delete("/api/channels/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID channel tidak valid",
      });
    }

    const [existing]: any = await pool.query(
      "SELECT * FROM channels WHERE id = ? LIMIT 1",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Channel tidak ditemukan",
      });
    }

    const requester = (req as any).user;
    const isOwner = existing[0].user_id === requester.id;
    const isAdmin = requester.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Akses ditolak. Bukan pemilik channel.",
      });
    }

    const [channelVideos]: any = await pool.query(
      "SELECT image_public_id FROM videos WHERE channel_id = ?",
      [id],
    );

    if (existing[0].avatar_public_id) {
      await cloudinary.uploader.destroy(existing[0].avatar_public_id);
    }
    if (existing[0].banner_public_id) {
      await cloudinary.uploader.destroy(existing[0].banner_public_id);
    }
    for (const v of channelVideos) {
      if (v.image_public_id) {
        await cloudinary.uploader.destroy(v.image_public_id);
      }
    }

    const [result]: any = await pool.query(
      "DELETE FROM channels WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Channel tidak ditemukan",
      });
    }

    res.json({
      message: "Berhasil menghapus channel",
    });
  } catch (error) {
    console.error("ERROR DELETE CHANNEL:", error);

    res.status(500).json({
      message: "Gagal menghapus channel",
    });
  }
});

app.get("/api/videos", verifyToken, async (req, res) => {
  try {
    const channelId = req.query.channel_id
      ? Number(req.query.channel_id)
      : undefined;
    const visibility =
      typeof req.query.visibility === "string"
        ? req.query.visibility
        : undefined;

    let sql = `SELECT v.*, c.name AS channel_name, u.username AS owner_username
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       JOIN users u ON c.user_id = u.id`;
    const params: any[] = [];
    const where: string[] = [];

    if (channelId !== undefined) {
      if (!Number.isSafeInteger(channelId) || channelId <= 0) {
        return res.status(400).json({
          message: "channel_id tidak valid",
        });
      }
      where.push("v.channel_id = ?");
      params.push(channelId);
    }

    if (visibility !== undefined) {
      if (!["public", "private", "unlisted"].includes(visibility)) {
        return res.status(400).json({
          message: "visibility tidak valid",
        });
      }
      where.push("v.visibility = ?");
      params.push(visibility);
    }

    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }
    sql += " ORDER BY v.created_at DESC";

    const [rows] = await pool.query(sql, params);

    res.json({
      message: "Berhasil mengambil data video",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil data video",
    });
  }
});

app.get("/api/videos/public", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const offset = (page - 1) * limit;

    const where = ["v.visibility = 'public'"];
    const params: any[] = [];

    if (search) {
      where.push("(v.title LIKE ? OR v.description LIKE ? OR c.name LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (category) {
      where.push("v.category = ?");
      params.push(category);
    }

    const base = `FROM videos v
       JOIN channels c ON v.channel_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE ${where.join(" AND ")}`;

    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) AS total ${base}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT v.*, c.name AS channel_name, c.avatar_url AS channel_avatar,
        u.username AS owner_username
       ${base} ORDER BY v.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    res.json({
      message: "Berhasil mengambil video publik",
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil video publik",
    });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID video tidak valid",
      });
    }

    const [rows]: any = await pool.query(
      `SELECT v.*, c.name AS channel_name, c.user_id AS channel_owner_id,
        u.username AS owner_username
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE v.id = ? LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Video tidak ditemukan",
      });
    }

    const video = rows[0];

    // Video public dapat diakses tanpa token.
    if (video.visibility !== "public") {
      const authHeader = req.headers.authorization;
      const token =
        authHeader?.startsWith("Bearer ") && authHeader.split(" ")[1]
          ? authHeader.split(" ")[1]
          : null;

      if (!token) {
        return res.status(422).json({
          message: "Please provide the token",
        });
      }

      try {
        const decoded: any = jwt.verify(
          token,
          process.env.JWT_SECRET ?? "rahasia-jwt-123",
        );
        const isOwner = video.channel_owner_id === decoded.id;
        const isAdmin = decoded.role === "admin";

        if (!isOwner && !isAdmin) {
          return res.status(403).json({
            message: "Akses ditolak. Video ini tidak publik.",
          });
        }
      } catch {
        return res.status(401).json({
          message: "Token tidak valid atau kadaluarsa",
        });
      }
    }

    res.json({
      message: "Berhasil mengambil detail video",
      data: video,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil detail video",
    });
  }
});

app.post(
  "/api/videos",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const validation = videoSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const {
        channel_id,
        title,
        description,
        category,
        duration_seconds,
        views_count,
        visibility,
      } = validation.data;

      const [channels]: any = await pool.query(
        "SELECT id, user_id FROM channels WHERE id = ? LIMIT 1",
        [channel_id],
      );

      if (channels.length === 0) {
        return res.status(404).json({
          message: "Channel tidak ditemukan",
        });
      }

      const requester = (req as any).user;
      const isOwner = channels[0].user_id === requester.id;
      const isAdmin = requester.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          message: "Akses ditolak. Bukan pemilik channel.",
        });
      }

      let image_url: string | null = null;
      let image_public_id: string | null = null;

      if (req.file) {
        const uploaded = await uploadBufferToCloudinary(
          req.file.buffer,
          req.file.mimetype,
          "videos/thumbnails",
        );
        image_url = uploaded.secure_url;
        image_public_id = uploaded.public_id;
      }

      const [result]: any = await pool.query(
        `INSERT INTO videos
        (channel_id, title, description, category, image_url, image_public_id, duration_seconds, views_count, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          channel_id,
          title,
          description ?? null,
          category ?? null,
          image_url,
          image_public_id,
          duration_seconds ?? 0,
          views_count ?? 0,
          visibility ?? "public",
        ],
      );

      res.status(201).json({
        message: "Berhasil menambahkan video",
        data: {
          id: result.insertId,
          channel_id,
          title,
          description: description ?? null,
          category: category ?? null,
          image_url,
          image_public_id,
          duration_seconds: duration_seconds ?? 0,
          views_count: views_count ?? 0,
          visibility: visibility ?? "public",
        },
      });
    } catch (error) {
      console.error("ERROR POST VIDEO:", error);

      res.status(500).json({
        message: "Gagal menambahkan video",
        error: error instanceof Error ? error.message : error,
      });
    }
  },
);

app.put(
  "/api/videos/:id",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "ID video tidak valid",
        });
      }

      const validation = videoSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Data tidak valid",
          error: validation.error.issues,
        });
      }

      const [existing]: any = await pool.query(
        `SELECT v.*, c.user_id AS owner_id
         FROM videos v
         JOIN channels c ON v.channel_id = c.id
         WHERE v.id = ? LIMIT 1`,
        [id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "Video tidak ditemukan",
        });
      }

      const requester = (req as any).user;
      const isOwner = existing[0].owner_id === requester.id;
      const isAdmin = requester.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          message: "Akses ditolak. Bukan pemilik video.",
        });
      }

      const {
        channel_id,
        title,
        description,
        category,
        duration_seconds,
        views_count,
        visibility,
      } = validation.data;

      const [targetChannel]: any = await pool.query(
        "SELECT id, user_id FROM channels WHERE id = ? LIMIT 1",
        [channel_id],
      );

      if (targetChannel.length === 0) {
        return res.status(404).json({
          message: "Channel tujuan tidak ditemukan",
        });
      }

      const isTargetOwner = targetChannel[0].user_id === requester.id;
      if (!isTargetOwner && !isAdmin) {
        return res.status(403).json({
          message: "Akses ditolak. Bukan pemilik channel tujuan.",
        });
      }

      let image_url: string | null = existing[0].image_url;
      let image_public_id: string | null = existing[0].image_public_id;
      let previous_public_id: string | null = null;

      if (req.file) {
        const uploaded = await uploadBufferToCloudinary(
          req.file.buffer,
          req.file.mimetype,
          "videos/thumbnails",
        );
        image_url = uploaded.secure_url;
        image_public_id = uploaded.public_id;
        previous_public_id = existing[0].image_public_id ?? null;
      }

      const [result]: any = await pool.query(
        `UPDATE videos
        SET channel_id = ?,
            title = ?,
            description = ?,
            category = ?,
            image_url = ?,
            image_public_id = ?,
            duration_seconds = ?,
            views_count = ?,
            visibility = ?
        WHERE id = ?`,
        [
          channel_id,
          title,
          description ?? null,
          category ?? null,
          image_url,
          image_public_id,
          duration_seconds ?? 0,
          views_count ?? 0,
          visibility ?? "public",
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Video tidak ditemukan",
        });
      }

      if (previous_public_id) {
        await cloudinary.uploader.destroy(previous_public_id);
      }

      res.json({
        message: "Berhasil mengubah video",
        data: {
          id,
          channel_id,
          title,
          description: description ?? null,
          category: category ?? null,
          image_url,
          image_public_id,
          duration_seconds: duration_seconds ?? 0,
          views_count: views_count ?? 0,
          visibility: visibility ?? "public",
        },
      });
    } catch (error) {
      console.error("ERROR PUT VIDEO:", error);

      res.status(500).json({
        message: "Gagal mengubah video",
      });
    }
  },
);

app.delete("/api/videos/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID video tidak valid",
      });
    }

    const [existing]: any = await pool.query(
      `SELECT v.*, c.user_id AS owner_id
       FROM videos v
       JOIN channels c ON v.channel_id = c.id
       WHERE v.id = ? LIMIT 1`,
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Video tidak ditemukan",
      });
    }

    const requester = (req as any).user;
    const isOwner = existing[0].owner_id === requester.id;
    const isAdmin = requester.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Akses ditolak. Bukan pemilik video.",
      });
    }

    if (existing[0].image_public_id) {
      await cloudinary.uploader.destroy(existing[0].image_public_id);
    }

    const [result]: any = await pool.query("DELETE FROM videos WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Video tidak ditemukan",
      });
    }

    res.json({
      message: "Berhasil menghapus video",
    });
  } catch (error) {
    console.error("ERROR DELETE VIDEO:", error);

    res.status(500).json({
      message: "Gagal menghapus video",
    });
  }
});

app.get("/api/users", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, role, created_at FROM users ORDER BY id ASC",
    );

    res.json({
      message: "Berhasil mengambil data user",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal mengambil data user",
    });
  }
});

const updateRoleSchema = z.object({
  role: z.enum(["admin", "user"]),
});

app.put(
  "/api/users/:id/role",
  verifyToken,
  adminMiddleware,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "ID user tidak valid",
        });
      }

      const validation = updateRoleSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Role tidak valid, gunakan 'admin' atau 'user'",
          error: validation.error.issues,
        });
      }

      const requesterId = (req as any).user.id;

      if (id === requesterId) {
        return res.status(400).json({
          message: "Tidak bisa mengubah role sendiri",
        });
      }

      const [existing]: any = await pool.query(
        "SELECT id, role FROM users WHERE id = ? LIMIT 1",
        [id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan",
        });
      }

      const [result]: any = await pool.query(
        "UPDATE users SET role = ? WHERE id = ?",
        [validation.data.role, id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan",
        });
      }

      res.json({
        message: "Berhasil mengubah role user",
        data: { id, role: validation.data.role },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Gagal mengubah role user",
      });
    }
  },
);

app.delete("/api/users/:id", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID user tidak valid",
      });
    }

    const [result]: any = await pool.query("DELETE FROM users WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    res.json({
      message: "Berhasil menghapus user",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Gagal menghapus user",
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
