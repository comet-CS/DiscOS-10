import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer(); // parse multipart/form-data

// Serve your frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// CORS for frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Proxy route
app.all("/proxy/:path(*)", upload.any(), async (req, res) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Missing Authorization header" });

  const url = "https://discord.com/api/v10/" + req.params.path;

  try {
    let headers = { Authorization: token };
    let body;

    // Handle file uploads (single or multiple)
    if (req.files && req.files.length > 0) {
      body = new FormData();
      req.files.forEach((file, i) => {
        body.append("file" + i, file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
          knownLength: file.size,
        });
      });
      if (req.body.content) body.append("content", req.body.content);
      headers = { ...headers, ...body.getHeaders() };
    } else if (!["GET", "HEAD"].includes(req.method)) {
      body = JSON.stringify(req.body);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    // Remove content-encoding to avoid browser decode errors
    res.status(response.status);
    response.headers.forEach((val, key) => {
      if (key.toLowerCase() !== "content-encoding") {
        res.setHeader(key, val);
      }
    });

    // Stream response directly
    response.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
});

// Vercel automatically provides a port; fallback to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy running on port ${PORT}`);
});
