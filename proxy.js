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

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
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
            // Only for file uploads
            body = new FormData();
            req.files.forEach((file, idx) => {
                body.append(`files[${idx}]`, file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                });
            });

            if (req.body.content) body.append("content", req.body.content);
            if (req.body.payload_json) body.append("payload_json", req.body.payload_json);

            headers = { ...headers, ...body.getHeaders() };
        } else if (!["GET", "HEAD"].includes(req.method) && Object.keys(req.body || {}).length > 0) {
            // For JSON requests (sending messages, editing, etc.)
            body = JSON.stringify(req.body);
            headers["Content-Type"] = "application/json";
        } 
        // For GET/HEAD → no body at all

        const response = await fetch(url, {
            method: req.method,
            headers,
            body,
        });

        // Pass through headers like content-type for images, etc.
        res.status(response.status);
        response.headers.forEach((val, key) => res.setHeader(key, val));

        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error("Proxy error:", err);
        res.status(500).send("Proxy error");
    }
});

// Railway/Heroku/Render friendly
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Proxy running on http://localhost:${PORT}`);
});
