import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import FormData from "form-data";
import zlib from "zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.all("/proxy/:path(*)", upload.any(), async (req, res) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Missing Authorization header" });

  const url = "https://discord.com/api/v10/" + req.params.path;

  try {
    let headers = { Authorization: token };
    let body;

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

    // Copy status
    res.status(response.status);

    // Copy headers (except content-encoding to avoid decode errors)
    response.headers.forEach((val, key) => {
      if (!["content-encoding", "content-length"].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });

    const buffer = await response.buffer();

    // If JSON, parse and return
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      res.send(buffer.toString("utf-8"));
    } else {
      // binary (images, attachments)
      res.send(buffer);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Proxy running on port ${PORT}`));
