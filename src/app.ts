  import express from "express";
  import cors from "cors";
  import { z } from "zod";
  import pool from "./db/index.ts";

  const app = express();
  const port = 8000;

  app.use(cors());
  app.use(express.json());

  const streamerSchema = z.object({
    namast: z.string().min(1).max(50),
    kategorist: z.string().min(1).max(50),
    subscriber: z.number().int().min(0),
    views: z.number().int().min(0),
  });


  app.get("/api/streamers", async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM streamers"
      );

      res.json({
        message: "Berhasil mengambil data streamer",
        data: rows,
      });

    } catch (error) {
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

      const {
        namast,
        kategorist,
        subscriber,
        views
      } = validation.data;

      await pool.query(
        `INSERT INTO streamers
        (namast, kategorist, subscriber, views)
        VALUES (?, ?, ?, ?)`,
        [namast, kategorist, subscriber, views]
      );

      res.status(201).json({
        message: "Berhasil menambahkan streamer",
      });

    } catch (error) {
      res.status(500).json({
        message: "Gagal menambahkan streamer",
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

      const {
        namast,
        kategorist,
        subscriber,
        views
      } = validation.data;

      const [result]: any = await pool.query(
        `UPDATE streamers
        SET namast = ?,
            kategorist = ?,
            subscriber = ?,
            views = ?
        WHERE id = ?`,
        [namast, kategorist, subscriber, views, id]
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
        [id]
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
      res.status(500).json({
        message: "Gagal menghapus streamer",
      });
    }
  });


  app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
  });