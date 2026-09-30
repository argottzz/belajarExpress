import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({
  path: "./.env",
});

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log("Cloudinary:");
console.log("Cloud Name:", cloudName);
console.log("API Key:", apiKey ? "ADA" : "KOSONG");
console.log("API Secret:", apiSecret ? "ADA" : "KOSONG");

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("Konfigurasi Cloudinary tidak lengkap");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;