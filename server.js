import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// 👇 necesario para __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG EXPRESS
app.use(cors());
app.use(express.json());

// PUERTO HOSTINGER
const PORT = process.env.PORT || 3000;

console.log("Puerto asignado:", PORT);

// CONFIG MYSQL
const db = mysql.createPool({
  host: "srv1782.hstgr.io",
  user: "u494447907_pastas2",
  password: "Pastas123456",
  database: "u494447907_pastas2",
  waitForConnections: true,
  connectionLimit: 10
});

// =======================
// 🔹 RUTAS API
// =======================

// ROOT
app.get("/api", (req, res) => {
  res.send("API funcionando 🚀");
});

// TEST MYSQL
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS test");
    res.json({ ok: true, rows });
  } catch (error) {
    console.error("ERROR MYSQL:", error);
    res.status(500).json({
      message: error.message,
      code: error.code
    });
  }
});

// PRODUCTOS
app.get("/api/productos", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, nombre, titulos, foto, puntos, pj, W, WP, Def, dif, apodo, ubic, E 
      FROM tabla
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo productos" });
  }
});

// CONFIGURACION
app.get("/configuracion", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM unidadmedida");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener configuracion" });
  }
});

// =======================
// 🔹 SERVIR REACT (IMPORTANTE)
// =======================

// carpeta dist generada por Vite
app.use(express.static(path.join(__dirname, "dist")));

// fallback para React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// =======================
// 🔹 START SERVER
// =======================

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} 🚀`);
});