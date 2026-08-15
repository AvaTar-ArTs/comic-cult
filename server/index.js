const express = require("express");
const cors = require("cors");
const { textToComic } = require("./utils/Controller.js");
const path = require("path");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const outputDir = path.resolve(__dirname, "./final/main");
const pdfDir = path.resolve(__dirname, "./pdfs");

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function makePdf() {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(outputDir)) {
        reject(new Error("No generated image directory exists."));
        return;
      }

      const imageFiles = fs.readdirSync(outputDir)
        .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
        .sort();

      if (imageFiles.length === 0) {
        reject(new Error("No generated images were found."));
        return;
      }

      fs.mkdirSync(pdfDir, { recursive: true });
      const pdfPath = path.join(pdfDir, \`comic-\${Date.now()}.pdf\`);
      const doc = new PDFDocument({ size: [512, 515] });
      const stream = fs.createWriteStream(pdfPath);

      doc.pipe(stream);
      imageFiles.forEach((imageFile, index) => {
        doc.image(path.join(outputDir, imageFile), 1, 1, { fit: [512, 512] });
        if (index < imageFiles.length - 1) doc.addPage();
      });
      doc.end();

      stream.on("finish", () => resolve(pdfPath));
      stream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function deliverPdf(pdfPath, res) {
  const recipient = process.env.COMIC_DELIVERY_TO;
  const transporter = createTransporter();

  if (!transporter || !recipient) {
    res.download(pdfPath, "comic.pdf");
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: process.env.COMIC_EMAIL_SUBJECT || "Your Comic",
      text: "Your generated comic is attached.",
      attachments: [{ filename: "comic.pdf", path: pdfPath }],
    });
    res.status(200).json({ message: "Comic delivered by email." });
  } catch (error) {
    console.error("Email delivery failed:", error);
    res.status(502).json({ error: "Comic generated, but email delivery failed." });
  }
}

app.get("/download", async (_req, res) => {
  try {
    const pdfPath = await makePdf();
    await deliverPdf(pdfPath, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/", async (req, res) => {
  try {
    const { userText, customization } = req.body;
    if (!userText || typeof userText !== "string") {
      res.status(400).json({ error: "userText is required." });
      return;
    }

    await textToComic(userText, customization);
    const pdfPath = await makePdf();
    await deliverPdf(pdfPath, res);
  } catch (error) {
    console.error("Comic generation failed:", error);
    res.status(500).json({ error: error.message || "Comic generation failed." });
  }
});

app.listen(PORT, () => console.log(\`App listening at localhost:\${PORT}\`));
