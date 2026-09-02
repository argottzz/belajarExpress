import express, {
  type Express,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { z } from "zod";
import pool from "./db/index.ts";

const app: Express = express();
const port = 8000;

app.use(express.json());
app.use(cors());

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
    .int("Subscriber harus berupa bilangan bulat")
    .min(0, "Subscriber tidak boleh negatif"),

  views: z
    .number()
    .int("Views harus berupa bilangan bulat")
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
    .int("Subscriber harus berupa bilangan bulat")
    .min(0, "Subscriber tidak boleh negatif"),

  views: z
    .number()
    .int("Views harus berupa bilangan bulat")
    .min(0, "Views tidak boleh negatif"),
});

const idSchema = z.coerce.number().int().positive();

app.post("/api/login", (req: Request, res: Response) => {
  res.json({
    message: req.body.email + " Berhasil login",
  });
});

app.get("/api/streamers", async (req: Request, res: Response) => {
  try {
    const [streamers] = await pool.query(
      "SELECT * FROM streamers"
    );

    res.status(200).json({
      message: "Berhasil fetch streamer",
      data: streamers,
    });
  } catch (error) {
    console.error("Error GET streamers:", error);

    res.status(500).json({
      message: "Gagal mengambil data streamer",
    });
  }
});

app.post("/api/streamers", async (req: Request, res: Response) => {
  try {
    const validation = streamerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Validasi data gagal",
        errors: validation.error.issues,
      });
      return;
    }

    const {
      namast,
      kategorist,
      subscriber,
      views,
    } = validation.data;

    const [result]: any = await pool.query(
      `INSERT INTO streamers
      (namast, kategorist, subscriber, views)
      VALUES (?, ?, ?, ?)`,
      [namast, kategorist, subscriber, views]
    );

    res.status(201).json({
      message: "Berhasil menambahkan streamer",
      data: {
        id: result.insertId,
        namast,
        kategorist,
        subscriber,
        views,
      },
    });
  } catch (error: any) {
    console.error("Error POST streamers:", error);

    res.status(500).json({
      message: "Gagal menambahkan streamer",
      error: error.message,
    });
  }
});

app.put("/api/streamers/:id", async (req: Request, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      res.status(400).json({
        message: "ID streamer tidak valid",
      });
      return;
    }

    const validation = streamerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Validasi data gagal",
        errors: validation.error.issues,
      });
      return;
    }

    const id = idValidation.data;

    const {
      namast,
      kategorist,
      subscriber,
      views,
    } = validation.data;

    const [result]: any = await pool.query(
      `UPDATE streamers
       SET namast = ?,
           kategorist = ?,
           subscriber = ?,
           views = ?
       WHERE id = ?`,
      [
        namast,
        kategorist,
        subscriber,
        views,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({
        message: "Data streamer tidak ditemukan",
      });
      return;
    }

    res.status(200).json({
      message: "Data streamer berhasil diubah",
      data: {
        id,
        namast,
        kategorist,
        subscriber,
        views,
      },
    });
  } catch (error: any) {
    console.error("Error PUT streamers:", error);

    res.status(500).json({
      message: "Gagal mengubah data streamer",
      error: error.message,
    });
  }
});

app.delete(
  "/api/streamers/:id",
  async (req: Request, res: Response) => {
    try {
      const idValidation = idSchema.safeParse(req.params.id);

      if (!idValidation.success) {
        res.status(400).json({
          message: "ID streamer tidak valid",
        });
        return;
      }

      const id = idValidation.data;

      const [result]: any = await pool.query(
        "DELETE FROM streamers WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        res.status(404).json({
          message: "Data streamer tidak ditemukan",
        });
        return;
      }

      res.status(200).json({
        message: "Data streamer berhasil dihapus",
      });
    } catch (error: any) {
      console.error("Error DELETE streamers:", error);

      res.status(500).json({
        message: "Gagal menghapus data streamer",
        error: error.message,
      });
    }
  }
);

app.get("/api/youtubers", async (req: Request, res: Response) => {
  try {
    const [youtubers] = await pool.query(
      "SELECT * FROM youtubers"
    );

    res.status(200).json({
      message: "Berhasil fetch youtuber",
      data: youtubers,
    });
  } catch (error) {
    console.error("Error GET youtubers:", error);

    res.status(500).json({
      message: "Gagal mengambil data youtuber",
    });
  }
});

app.post("/api/youtubers", async (req: Request, res: Response) => {
  try {
    const validation = youtuberSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Validasi data gagal",
        errors: validation.error.issues,
      });
      return;
    }

    const {
      namayt,
      kategoriyt,
      subscriber,
      views,
    } = validation.data;

    const [result]: any = await pool.query(
      `INSERT INTO youtubers
      (namayt, kategoriyt, subscriber, views)
      VALUES (?, ?, ?, ?)`,
      [
        namayt,
        kategoriyt,
        subscriber,
        views,
      ]
    );

    res.status(201).json({
      message: "Berhasil menambahkan youtuber",
      data: {
        id: result.insertId,
        namayt,
        kategoriyt,
        subscriber,
        views,
      },
    });
  } catch (error: any) {
    console.error("Error POST youtubers:", error);

    res.status(500).json({
      message: "Gagal menambahkan youtuber",
      error: error.message,
    });
  }
});

app.put("/api/youtubers/:id", async (req: Request, res: Response) => {
  try {
    const idValidation = idSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      res.status(400).json({
        message: "ID youtuber tidak valid",
      });
      return;
    }

    const validation = youtuberSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Validasi data gagal",
        errors: validation.error.issues,
      });
      return;
    }

    const id = idValidation.data;

    const {
      namayt,
      kategoriyt,
      subscriber,
      views,
    } = validation.data;

    const [result]: any = await pool.query(
      `UPDATE youtubers
       SET namayt = ?,
           kategoriyt = ?,
           subscriber = ?,
           views = ?
       WHERE id = ?`,
      [
        namayt,
        kategoriyt,
        subscriber,
        views,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({
        message: "Data youtuber tidak ditemukan",
      });
      return;
    }

    res.status(200).json({
      message: "Data youtuber berhasil diubah",
      data: {
        id,
        namayt,
        kategoriyt,
        subscriber,
        views,
      },
    });
  } catch (error: any) {
    console.error("Error PUT youtubers:", error);

    res.status(500).json({
      message: "Gagal mengubah data youtuber",
      error: error.message,
    });
  }
});

app.delete(
  "/api/youtubers/:id",
  async (req: Request, res: Response) => {
    try {
      const idValidation = idSchema.safeParse(req.params.id);

      if (!idValidation.success) {
        res.status(400).json({
          message: "ID youtuber tidak valid",
        });
        return;
      }

      const id = idValidation.data;

      const [result]: any = await pool.query(
        "DELETE FROM youtubers WHERE id = ?",
        [id]
      );

      if (result.affectedRows === 0) {
        res.status(404).json({
          message: "Data youtuber tidak ditemukan",
        });
        return;
      }

      res.status(200).json({
        message: "Data youtuber berhasil dihapus",
      });
    } catch (error: any) {
      console.error("Error DELETE youtubers:", error);

      res.status(500).json({
        message: "Gagal menghapus data youtuber",
        error: error.message,
      });
    }
  }
);

app.listen(port, () => {
  console.log(
    `Server berjalan di http://localhost:${port}`
  );
});
