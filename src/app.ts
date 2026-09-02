import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod";
import pool from "./db/index.ts";

const app: Express = express();
const port = 8000;

app.use(cors());
app.use(express.json());

const streamerSchema = z.object({
  namast: z
    .string()
    .min(1, "Nama streamer harus diisi")
    .max(50, "Nama streamer maksimal 50 karakter"),
  kategorist: z
    .string()
    .min(1, "Kategori streamer harus diisi")
    .max(50, "Kategori maksimal 50 karakter"),
  subscriber: z
    .number()
    .int("Subscriber harus bilangan bulat")
    .min(0, "Subscriber tidak boleh negatif"),
  views: z
    .number()
    .int("Views harus bilangan bulat")
    .min(0, "Views tidak boleh negatif"),
});

const youtuberSchema = z.object({
  namayt: z
    .string()
    .min(1, "Nama youtuber harus diisi")
    .max(50, "Nama youtuber maksimal 50 karakter"),
  kategoriyt: z
    .string()
    .min(1, "Kategori youtuber harus diisi")
    .max(50, "Kategori maksimal 50 karakter"),
  subscriber: z
    .number()
    .int("Subscriber harus bilangan bulat")
    .min(0, "Subscriber tidak boleh negatif"),
  views: z
    .number()
    .int("Views harus bilangan bulat")
    .min(0, "Views tidak boleh negatif"),
});

const idSchema = z.coerce
  .number()
  .int()
  .positive("ID harus berupa angka positif");

const sendError = (
  res: Response,
  status: number,
  message: string,
  error?: unknown,
) => {
  res.status(status).json({
    message,
    ...(error !== undefined ? { error } : {}),
  });
};

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "API berjalan dengan baik",
  });
});

app.post("/api/login", (req: Request, res: Response) => {
  const email = req.body?.email;

  if (typeof email !== "string" || email.trim() === "") {
    return sendError(res, 400, "Email harus diisi");
  }

  return res.status(200).json({
    message: `${email} Berhasil login`,
  });
});

app.get("/api/streamers", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query("SELECT * FROM streamers");

    res.status(200).json({
      message: "Berhasil mengambil data streamer",
      data: rows,
    });
  } catch (error) {
    console.error("GET STREAMERS ERROR:", error);
    sendError(
      res,
      500,
      "Gagal mengambil data streamer",
      error instanceof Error ? error.message : error,
    );
  }
});

app.get("/api/streamers/:id", async (req: Request, res: Response) => {
  try {
    const validation = idSchema.safeParse(req.params.id);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "ID streamer tidak valid",
        validation.error.issues,
      );
    }

    const id = validation.data;
    const [rows]: any = await pool.query(
      "SELECT * FROM streamers WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return sendError(res, 404, "Data streamer tidak ditemukan");
    }

    return res.status(200).json({
      message: "Berhasil mengambil data streamer",
      data: rows[0],
    });
  } catch (error) {
    console.error("GET STREAMER BY ID ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal mengambil data streamer",
      error instanceof Error ? error.message : error,
    );
  }
});

app.post("/api/streamers", async (req: Request, res: Response) => {
  try {
    const validation = streamerSchema.safeParse(req.body);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "Validasi data streamer gagal",
        validation.error.issues,
      );
    }

    const { namast, kategorist, subscriber, views } = validation.data;
    const [result]: any = await pool.query(
      `INSERT INTO streamers (namast, kategorist, subscriber, views) VALUES (?, ?, ?, ?)`,
      [namast, kategorist, subscriber, views],
    );

    return res.status(201).json({
      message: "Berhasil menambahkan streamer",
      data: {
        id: result.insertId,
        namast,
        kategorist,
        subscriber,
        views,
      },
    });
  } catch (error) {
    console.error("POST STREAMER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal menambahkan streamer",
      error instanceof Error ? error.message : error,
    );
  }
});

app.put("/api/streamers/:id", async (req: Request, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      return sendError(
        res,
        400,
        "ID streamer tidak valid",
        idValidation.error.issues,
      );
    }

    const bodyValidation = streamerSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return sendError(
        res,
        400,
        "Validasi data streamer gagal",
        bodyValidation.error.issues,
      );
    }

    const id = idValidation.data;
    const { namast, kategorist, subscriber, views } = bodyValidation.data;
    const [result]: any = await pool.query(
      `UPDATE streamers SET namast = ?, kategorist = ?, subscriber = ?, views = ? WHERE id = ?`,
      [namast, kategorist, subscriber, views, id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Data streamer tidak ditemukan");
    }

    return res.status(200).json({
      message: "Data streamer berhasil diubah",
      data: {
        id,
        namast,
        kategorist,
        subscriber,
        views,
      },
    });
  } catch (error) {
    console.error("PUT STREAMER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal mengubah data streamer",
      error instanceof Error ? error.message : error,
    );
  }
});

app.delete("/api/streamers/:id", async (req: Request, res: Response) => {
  try {
    const validation = idSchema.safeParse(req.params.id);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "ID streamer tidak valid",
        validation.error.issues,
      );
    }

    const id = validation.data;
    const [result]: any = await pool.query(
      "DELETE FROM streamers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Data streamer tidak ditemukan");
    }

    return res.status(200).json({
      message: "Data streamer berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE STREAMER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal menghapus data streamer",
      error instanceof Error ? error.message : error,
    );
  }
});

app.get("/api/youtubers", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query("SELECT * FROM youtubers");

    res.status(200).json({
      message: "Berhasil mengambil data youtuber",
      data: rows,
    });
  } catch (error) {
    console.error("GET YOUTUBERS ERROR:", error);
    sendError(
      res,
      500,
      "Gagal mengambil data youtuber",
      error instanceof Error ? error.message : error,
    );
  }
});

app.get("/api/youtubers/:id", async (req: Request, res: Response) => {
  try {
    const validation = idSchema.safeParse(req.params.id);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "ID youtuber tidak valid",
        validation.error.issues,
      );
    }

    const id = validation.data;
    const [rows]: any = await pool.query(
      "SELECT * FROM youtubers WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return sendError(res, 404, "Data youtuber tidak ditemukan");
    }

    return res.status(200).json({
      message: "Berhasil mengambil data youtuber",
      data: rows[0],
    });
  } catch (error) {
    console.error("GET YOUTUBER BY ID ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal mengambil data youtuber",
      error instanceof Error ? error.message : error,
    );
  }
});

app.post("/api/youtubers", async (req: Request, res: Response) => {
  try {
    const validation = youtuberSchema.safeParse(req.body);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "Validasi data youtuber gagal",
        validation.error.issues,
      );
    }

    const { namayt, kategoriyt, subscriber, views } = validation.data;
    const [result]: any = await pool.query(
      `INSERT INTO youtubers (namayt, kategoriyt, subscriber, views) VALUES (?, ?, ?, ?)`,
      [namayt, kategoriyt, subscriber, views],
    );

    return res.status(201).json({
      message: "Berhasil menambahkan youtuber",
      data: {
        id: result.insertId,
        namayt,
        kategoriyt,
        subscriber,
        views,
      },
    });
  } catch (error) {
    console.error("POST YOUTUBER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal menambahkan youtuber",
      error instanceof Error ? error.message : error,
    );
  }
});

app.put("/api/youtubers/:id", async (req: Request, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      return sendError(
        res,
        400,
        "ID youtuber tidak valid",
        idValidation.error.issues,
      );
    }

    const bodyValidation = youtuberSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return sendError(
        res,
        400,
        "Validasi data youtuber gagal",
        bodyValidation.error.issues,
      );
    }

    const id = idValidation.data;
    const { namayt, kategoriyt, subscriber, views } = bodyValidation.data;
    const [result]: any = await pool.query(
      `UPDATE youtubers SET namayt = ?, kategoriyt = ?, subscriber = ?, views = ? WHERE id = ?`,
      [namayt, kategoriyt, subscriber, views, id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Data youtuber tidak ditemukan");
    }

    return res.status(200).json({
      message: "Data youtuber berhasil diubah",
      data: {
        id,
        namayt,
        kategoriyt,
        subscriber,
        views,
      },
    });
  } catch (error) {
    console.error("PUT YOUTUBER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal mengubah data youtuber",
      error instanceof Error ? error.message : error,
    );
  }
});

app.delete("/api/youtubers/:id", async (req: Request, res: Response) => {
  try {
    const validation = idSchema.safeParse(req.params.id);

    if (!validation.success) {
      return sendError(
        res,
        400,
        "ID youtuber tidak valid",
        validation.error.issues,
      );
    }

    const id = validation.data;
    const [result]: any = await pool.query(
      "DELETE FROM youtubers WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Data youtuber tidak ditemukan");
    }

    return res.status(200).json({
      message: "Data youtuber berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE YOUTUBER ERROR:", error);
    return sendError(
      res,
      500,
      "Gagal menghapus data youtuber",
      error instanceof Error ? error.message : error,
    );
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
