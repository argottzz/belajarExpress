import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      cb(new Error("Hanya file jpg, jpeg, png yang diperbolehkan"));
      return;
    }
    cb(null, true);
  },
});

export default upload;