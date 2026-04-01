import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();

// CONFIG EXPRESS
app.use(cors());
app.use(express.json());

// PUERTO HOSTINGER (IMPORTANTE)
const PORT = process.env.PORT || 3000;

console.log("Puerto asignado:", PORT);

// CONFIG MYSQL (AJUSTAR SI NECESARIO)
const db = mysql.createPool({
  host: "localhost",
  user: "u494447907_fede",
  password: "Pastas_25",
  database: "u984595023_pastas",
  waitForConnections: true,
  connectionLimit: 10
});

// TEST ROOT (sirve para verificar deploy)
app.get("/", (req, res) => {
  res.send("Servidor funcionando correctamente 🚀");
});

// TEST MYSQL
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 AS test");
    res.json({
      ok: true,
      mysql: rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error conexión MySQL"
    });
  }
});

// EJEMPLO API
app.get("/api/productos", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM productos");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo productos"
    });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} 🚀`);
});