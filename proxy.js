// Replace upload.single("file") with upload.any()
app.all("/proxy/:path(*)", upload.any(), async (req, res) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "Missing Authorization header" });

  const url = "https://discord.com/api/v10/" + req.params.path;

  try {
    let headers = { Authorization: token };
    let body;

    // If any files were uploaded, build a FormData and append all of them
    if (req.files && req.files.length > 0) {
      body = new FormData();
      // append each file as 'file' field (Discord accepts repeated file fields)
      for (let i = 0; i < req.files.length; i++) {
        const f = req.files[i];
        body.append("file", f.buffer, {
          filename: f.originalname,
          contentType: f.mimetype,
          knownLength: f.size,
        });
      }
      // Also append other form fields (e.g. content)
      for (const k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== undefined) {
          body.append(k, req.body[k]);
        }
      }
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
