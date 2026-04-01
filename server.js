import express from "express";

const app = express();

// PUERTO (Hostinger lo maneja)
const PORT = process.env.PORT || 3000;

// Endpoint raíz
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// Endpoint de prueba
app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "Todo funciona correctamente"
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});