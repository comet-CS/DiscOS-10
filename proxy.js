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

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

app.all("/proxy/:path(*)", upload.single("file"), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ message: "Missing Authorization header" });

    const url = "https://discord.com/api/v10/" + req.params.path;

    try {
        let headers = { Authorization: token };
        let body;

        if (req.file) {
            // Correctly attach file using form-data package
            body = new FormData();
            body.append("file", req.file.buffer, {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                knownLength: req.file.size,
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

        const text = await response.text();
        res.status(response.status).send(text);
    } catch (err) {
        console.error(err);
        res.status(500).send("Proxy error");
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log("Proxy running on http://localhost:3000");
    console.log("Accessible on LAN at http://YOUR_PC_IP:3000");
});
