import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
const app = express();
const SECRET = process.env.JWT_SECRET || "secreto123";
// CONFIG EXPRESS
app.use(cors());
app.use(express.json());

// PUERTO HOSTINGER (IMPORTANTE)
const PORT = process.env.PORT || 3000;

console.log("Puerto asignado:", PORT);

// CONFIG MYSQL (AJUSTAR SI NECESARIO)
const db = mysql.createPool({
  host: "srv1782.hstgr.io",
  user: "u494447907_pastas2",
  password: "Pastas123456",
  database: "u494447907_pastas2",
  waitForConnections: true,
  connectionLimit: 10
});


app.get('/', (req,res)=>{
    res.send('Hola Mundo');
});

// --------------------
// CONFIGURACION
// --------------------

app.get('/configuracion', async (req,res)=>{
    try{
        const [rows] = await db.query("SELECT * FROM unidadmedida");
        res.json(rows);
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener configuracion" });
    }
});


// --------------------
// DEPOSITOS
// --------------------

app.get('/deposito', async (req,res)=>{
    try{
        const [rows] = await db.query("SELECT * FROM deposito WHERE esActivo = 1");
        res.json(rows);
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener deposito" });
    }
});
app.get('/deposito/inactivos', async (req,res)=>{
    try{
        const [rows] = await db.query("SELECT * FROM deposito WHERE esActivo = 0");
        res.json(rows);
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener deposito" });
    }
});
app.post('/deposito', async (req,res)=>{
    const {codigo,denominacion,ubicacion,esProduccion} = req.body
    try{
        if (!codigo || !denominacion) {
            return res.status(400).json({ error: "Faltan datos obligatorios" })
        }
        const [existe] = await db.query(
            `SELECT id FROM deposito 
                WHERE (denominacion = ? OR codigo = ?)`,
            [denominacion, codigo]
        )

        if (existe.length > 0) {
            return res.status(400).json({ 
                error: "Ya existe un depósito con ese nombre" 
            })
        }
        const [result] = await db.query(`
            INSERT INTO deposito
            (codigo, denominacion, ubicacion, esProduccion, esActivo)
            VALUES (?,?,?,?,true)
        `,[codigo,denominacion,ubicacion,esProduccion])
        res.json({
            message:"Deposito creado",
            id: result.insertId
        })
    }catch(error){
        console.error(error)
        res.status(500).json({
            error:"Error al crear deposito"
        })
    }
})
app.put('/deposito/desactivar', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: "ID no enviado" });
        }
        const [stockMP] = await db.query(
            "SELECT COUNT(*) as total FROM stockmateriaprima WHERE depositoId = ? AND cantidad > 0",
            [id]
        )
        const [stockProd] = await db.query(
            "SELECT COUNT(*) as total FROM stockproducto WHERE depositoId = ? AND cantidad > 0",
            [id]
        )

        if (stockMP[0].total > 0 || stockProd[0].total > 0) {
            return res.status(400).json({ 
                error: "No se puede desactivar: el depósito tiene stock" 
            })
        }
        const [result] = await db.query(
            "UPDATE deposito SET esActivo = false WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Depósito no encontrado" });
        }

        res.json({ message: "Depósito desactivado correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al desactivar depósito" });
    }
});
app.put('/deposito/activar', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: "ID no enviado" });
        }

        const [result] = await db.query(
            "UPDATE deposito SET esActivo = true WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Depósito no encontrado" });
        }

        res.json({ message: "Depósito activado correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al activar depósito" });
    }
});
app.put('/deposito/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { codigo, denominacion, ubicacion, esProduccion } = req.body

        if (!codigo || !denominacion) {
            return res.status(400).json({ error: "Faltan datos obligatorios" })
        }

        // 🔴 VALIDAR SI YA EXISTE (excluyendo el mismo ID)
        const [existe] = await db.query(
            `SELECT id FROM deposito 
             WHERE (denominacion = ? OR codigo = ?) AND id != ?`,
            [denominacion, codigo,id]
        )

        if (existe.length > 0) {
            return res.status(400).json({ 
                error: "Ya existe un depósito con ese nombre" 
            })
        }

        // 🔵 UPDATE
        const [result] = await db.query(
            `UPDATE deposito 
             SET codigo=?, denominacion=?, ubicacion=?, esProduccion=?
             WHERE id=?`,
            [codigo, denominacion, ubicacion, esProduccion, id]
        )

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Depósito no encontrado" })
        }

        res.json({ message: "Depósito actualizado correctamente" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al actualizar depósito" })
    }
})
// --------------------
// INGREDIENTES
// --------------------

app.get('/ingredientes', async (req,res)=>{
    try{
        const [rows] = await db.query(`
            SELECT 
                i.id,
                i.nombre,
                i.costo,
                i.factorConversion,

                uc.nombre AS unidad_compra,
                uc.abreviatura AS unidad_compra_abrev,

                ur.nombre AS unidad_receta,
                ur.abreviatura AS unidad_receta_abrev,

                smp.cantidad as cantidad,
                smp.id as idStock,
                dpt.codigo as codigo

            FROM ingrediente i

            JOIN unidadmedida uc 
            ON i.unidadCompraId = uc.id

            JOIN unidadmedida ur 
            ON i.unidadRecetaId = ur.id
            
            LEFT JOIN stockmateriaprima smp
            on i.id = ingredienteId

            LEFT JOIN deposito dpt
            on smp.depositoId = dpt.id
            ORDER BY i.nombre ASC
        `);
        res.json(rows);
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener los ingredientes" });
    }
});

app.get('/ingredientes/elementos', async (req,res)=>{
    try{
        const [rows] = await db.query(`
            SELECT 
                i.id,
                i.nombre,
                umc.nombre AS unidad_compra,
                umr.nombre AS unidad_receta,
                ult_compra.costo,
                ult_compra.cantidad,
                ult_compra.costo_unitario
            FROM ingrediente i

            JOIN unidadmedida umc
            ON i.unidadCompraId = umc.id

            JOIN unidadmedida umr
            ON i.unidadRecetaId = umr.id

            LEFT JOIN (
                SELECT 
                    cd1.ingrediente_id, 
                    cd1.costo,
                    cd1.cantidad,
                    (cd1.costo / cd1.cantidad) AS costo_unitario
                FROM compras_detalle cd1
                INNER JOIN compras c1 ON cd1.compra_id = c1.id
                WHERE c1.fecha = (
                    SELECT MAX(c2.fecha)
                    FROM compras_detalle cd2
                    INNER JOIN compras c2 ON cd2.compra_id = c2.id
                    WHERE cd2.ingrediente_id = cd1.ingrediente_id
                )
            ) ult_compra 
            ON i.id = ult_compra.ingrediente_id
        `);
        res.json(rows);
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener los ingredientes" });
    }
});
app.post('/ingredientes', async (req,res)=>{
    try{

        let {
            nombre,
            unidadCompraId,
            unidadRecetaId,
            costo,
            factorConversion
        } = req.body

        // 🔒 validaciones
        if(!nombre || !unidadCompraId || !unidadRecetaId){
            return res.status(400).json({error:"Faltan datos"})
        }

        costo = costo ? Number(costo) : null
        factorConversion = Number(factorConversion)

        if(factorConversion <= 0){
            return res.status(400).json({error:"Factor debe ser mayor a 0"})
        }

        if(costo != null && costo <= 0){
            return res.status(400).json({error:"Costo debe ser mayor a 0"})
        }

        const [result] = await db.query(`
            INSERT INTO ingrediente
            (nombre, unidadCompraId, unidadRecetaId, costo, factorConversion)
            VALUES (?,?,?,?,?)
        `,[
            nombre,
            unidadCompraId,
            unidadRecetaId,
            costo,
            factorConversion
        ])

        res.json({
            message:"Ingrediente creado",
            id: result.insertId
        })

    }catch(error){
        console.error(error)
        res.status(500).json({
            error:"Error al crear ingrediente"
        })
    }
})
app.put('/ingredientes/:id', async (req, res) => {
    try {
        const { id } = req.params

        let {
            nombre,
            unidadCompraId,
            unidadRecetaId,
            costo,
            factorConversion
        } = req.body

        costo = req.body.costo != null ? Number(req.body.costo) : null
        factorConversion = Number(factorConversion)

        if (factorConversion <= 0) {
            return res.status(400).json({ error: "Valores inválidos" })
        }
        if (costo !== null && costo <= 0) {
            return res.status(400).json({ error: "Valores inválidos" })
        }

        // 🔥 VALIDAR SI ESTÁ EN USO
        const [rows] = await db.query(`
            SELECT COUNT(*) as total 
            FROM recetaingrediente 
            WHERE ingredienteId = ?
        `, [id])

        if (rows[0].total > 0) {
            return res.status(400).json({
                error: "No se puede editar: está en uso en recetas"
            })
        }

        await db.query(`
            UPDATE ingrediente 
            SET nombre=?, unidadCompraId=?, unidadRecetaId=?, costo=?, factorConversion=?
            WHERE id=?
        `, [
            nombre,
            unidadCompraId,
            unidadRecetaId,
            costo,
            factorConversion,
            id
        ])

        res.json({ message: "Ingrediente actualizado" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al actualizar" })
    }
})
app.get('/ingredientes/:id/en-uso', async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT COUNT(*) as total
            FROM recetaingrediente
            WHERE ingredienteId = ?
        `, [id]);

        res.json({
            enUso: rows[0].total > 0
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al verificar uso" });
    }
});
// --------------------
// STOCK MATERIA PRIMA
// --------------------

app.get('/stock-materia-prima', async (req,res)=>{
    try{

        const [rows] = await db.query(`
            SELECT 
                s.id,
                s.ingredienteId,
                s.depositoId,
                i.nombre AS ingrediente,
                d.denominacion AS deposito,
                SUM(s.cantidad) AS cantidad,
                i.factorConversion,
                um.abreviatura,
                s.fechavencimiento
            FROM stockmateriaprima s

            JOIN ingrediente i 
            ON s.ingredienteId = i.id

            JOIN deposito d 
            ON s.depositoId = d.id

            JOIN unidadmedida um
            ON i.unidadCompraId = um.id

            GROUP BY s.ingredienteId, s.depositoId
        `);

        res.json(rows);

    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener los stock de materia-prima" });
    }
});
app.post('/stock-materia-prima', async (req,res)=>{
    const {ingredienteId,depositoId,cantidad} = req.body
    try{

        const [result] = await db.query(`
            INSERT INTO stockmateriaprima
            (ingredienteId, depositoId, cantidad)
            VALUES (?,?,?)
            ON DUPLICATE KEY UPDATE
            cantidad = cantidad + VALUES(cantidad)
        `,[ingredienteId,depositoId,cantidad]);
        res.json({
            message:"Stock actualizado",
            id: result.insertId
        })
    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al crear stock de materia-prima" });
    }
});
app.put('/stock-materia-prima/mover', async (req,res)=>{
    const connection = await db.getConnection()

    try{
        await connection.beginTransaction()

        const {
            ingredienteId,
            depositoOrigenId,
            depositoDestinoId,
            cantidad
        } = req.body

        console.log("📥 REQUEST:", {
            ingredienteId,
            depositoOrigenId,
            depositoDestinoId,
            cantidad
        })

        // 🔍 VER TODO EL STOCK DEL INGREDIENTE
        const [todoStock] = await connection.query(`
            SELECT * FROM stockmateriaprima
            WHERE ingredienteId=?
        `,[ingredienteId])

        console.log("📦 STOCK COMPLETO DEL INGREDIENTE:", todoStock)

        // 🔴 VALIDAR STOCK SUFICIENTE
        const [stock] = await connection.query(`
            SELECT SUM(cantidad) as cantidad
            FROM stockmateriaprima
            WHERE ingredienteId=? AND depositoId=?
        `,[ingredienteId, depositoOrigenId])

        console.log("🔍 STOCK ORIGEN:", stock)

        if(!stock[0].cantidad){
            throw new Error("No hay stock en el depósito origen")
        }

        if(stock[0].cantidad < cantidad){
            throw new Error("Stock insuficiente")
        }

        // 🟡 RESTAR ORIGEN
        const [resultUpdate] = await connection.query(`
            UPDATE stockmateriaprima
            SET cantidad = cantidad - ?
            WHERE ingredienteId=? AND depositoId=?
        `,[cantidad, ingredienteId, depositoOrigenId])

        console.log("🟡 RESTA RESULT:", resultUpdate)

        // 🔍 VER STOCK DESPUÉS DE RESTAR
        const [stockDespuesResta] = await connection.query(`
            SELECT * FROM stockmateriaprima
            WHERE ingredienteId=? AND depositoId=?
        `,[ingredienteId, depositoOrigenId])

        console.log("📉 STOCK ORIGEN DESPUÉS:", stockDespuesResta)

        // 🟢 SUMAR DESTINO
        const [resultInsert] = await connection.query(`
            INSERT INTO stockmateriaprima (ingredienteId, depositoId, cantidad)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            cantidad = cantidad + VALUES(cantidad)
        `,[ingredienteId, depositoDestinoId, cantidad])

        console.log("🟢 INSERT/UPDATE DESTINO:", resultInsert)

        // 🔍 VER STOCK DESTINO
        const [stockDestino] = await connection.query(`
            SELECT * FROM stockmateriaprima
            WHERE ingredienteId=? AND depositoId=?
        `,[ingredienteId, depositoDestinoId])

        console.log("📈 STOCK DESTINO DESPUÉS:", stockDestino)

        await connection.commit()

        console.log("✅ COMMIT OK")

        res.json({message:"Stock movido correctamente"})

    }catch(error){
        console.error("❌ ERROR:", error.message)

        await connection.rollback()
        console.log("↩️ ROLLBACK")

        res.status(500).json({error:error.message})
    }finally{
        connection.release()
    }
})
app.put('/stock-materia-prima/:id', async (req, res) => {
    const { id } = req.params
    const { ingredienteId, depositoId, cantidad } = req.body

    try {
        await db.query(
            `UPDATE stockmateriaprima 
             SET ingredienteId=?, depositoId=?, cantidad=? 
             WHERE id=?`,
            [ingredienteId, depositoId, cantidad, id]
        )

        res.json({ message: "Stock actualizado" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al actualizar stock" })
    }
})

// --------------------
// RECETAS
// --------------------

app.get('/recetas', async (req,res)=>{
    try{

        const [rows] = await db.query(`
            SELECT 
                r.id,
                r.nombre,
                r.rinde,
                u.nombre AS unidad_rinde,
                r.costoProduccion,
                COUNT(ri.id) AS ingredientes,
                r.generaIngrediente
            FROM receta r

            JOIN unidadmedida u 
            ON r.unidadRindeId = u.id

            LEFT JOIN recetaingrediente ri
            ON ri.recetaId = r.id

            GROUP BY r.id
        `);

        res.json(rows);

    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al obtener las recetas" });
    }
});


// --------------------
// INGREDIENTES DE UNA RECETA
// --------------------

app.get('/recetas/:id/ingredientes', async (req, res) => {
    try {
        const { id } = req.params

        const [rows] = await db.query(`
            SELECT 
                ri.id AS filaId,
                ri.ingredienteId,
                ri.recetaRefId,
                CASE 
                    WHEN ri.recetaRefId IS NOT NULL THEN 'receta'
                    ELSE 'ingrediente'
                END AS tipo,
                i.nombre AS ingrediente,
                re.nombre AS receta,
                ri.cantidad,
                i.factorConversion,
                uc.abreviatura AS unidadCompraAbrev,
                ur.abreviatura AS unidadRecetaAbrev,
                i.costo,
                re.costoProduccion AS costoReceta,
                re.rinde AS rindeReceta
            FROM recetaingrediente ri
            LEFT JOIN ingrediente i ON ri.ingredienteId = i.id
            LEFT JOIN unidadmedida uc ON i.unidadCompraId = uc.id
            LEFT JOIN unidadmedida ur ON i.unidadRecetaId = ur.id
            LEFT JOIN receta re ON ri.recetaRefId = re.id
            WHERE ri.recetaId = ?
        `, [id])

        res.json(rows)

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al obtener ingredientes" })
    }
})
app.get('/recetas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { depositoId } = req.query;

        // Validamos que existan los parámetros para evitar errores de SQL
        if (!id || !depositoId) {
            return res.status(400).json({ error: "Faltan parámetros: id o depositoId" });
        }

const [rows] = await db.query(`
    SELECT 
        ri.id AS filaId,
        CASE 
            WHEN ri.recetaRefId IS NOT NULL THEN 'receta'
            ELSE 'ingrediente'
        END AS tipo,
        CASE 
            WHEN ri.recetaRefId IS NOT NULL THEN re.nombre
            ELSE i.nombre
        END AS ingrediente,
        ri.cantidad,
        IFNULL(SUM(smp.cantidad), 0) AS stockReceta,
        i.factorConversion,
        uc.abreviatura AS unidadCompraAbrev,
        ur.abreviatura AS unidadRecetaAbrev,
        (
            SELECT GROUP_CONCAT(
                CONCAT(sp.id, '|', sp.lote, '|', sp.cantidad, '|', IFNULL(pr.fechaVencimiento, ''))
                SEPARATOR '|||'
            )
            FROM stockproducto sp
            LEFT JOIN produccionregistro pr
                ON sp.lote = pr.numeroLote
                AND pr.recetaId = ri.recetaRefId
            WHERE sp.productoId IN (
                SELECT pt.id 
                FROM productoterminado pt
                WHERE pt.recetaId = ri.recetaRefId
            )
            AND sp.depositoId = ?
            AND sp.cantidad > 0
        ) AS lotes_string
    FROM recetaingrediente ri
    LEFT JOIN ingrediente i ON ri.ingredienteId = i.id
    LEFT JOIN unidadmedida uc ON i.unidadCompraId = uc.id
    LEFT JOIN unidadmedida ur ON i.unidadRecetaId = ur.id
    LEFT JOIN stockmateriaprima smp ON i.id = smp.ingredienteId AND smp.depositoId = ?
    LEFT JOIN receta re ON ri.recetaRefId = re.id
    WHERE ri.recetaId = ?
    GROUP BY 
        ri.id, tipo, ingrediente, ri.cantidad, 
        i.factorConversion, uc.abreviatura, ur.abreviatura
`, [depositoId, depositoId, id]);

        // Transformamos el string de lotes en un array de objetos real
        const parsedRows = rows.map(r => {
            let lotesArray = [];
            if (r.lotes_string) {
                lotesArray = r.lotes_string.split('|||').map(item => {
                    const [idLote, lote, cant, fechaVenc] = item.split('|');
                    return {
                        idLote: Number(idLote),
                        lote,
                        cantidad: Number(cant),
                        fechaVencimiento: fechaVenc || null
                    };
                });
            }

            // Limpiamos el objeto para el frontend
            const { lotes_string, ...finalRow } = r;
            return {
                ...finalRow,
                lotes: lotesArray
            };
        });

        res.json(parsedRows);

    } catch (error) {
        console.error("🔥 Error detallado en el backend:", error);
        res.status(500).json({ 
            error: "Error interno del servidor", 
            details: error.message 
        });
    }
});
app.get('/recetas/produccion/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { depositoId } = req.query;

        const [rows] = await db.query(`
            SELECT 
                i.id,
                i.nombre AS ingrediente,
                u.abreviatura,
                ri.cantidad,
                i.costo,
                sp.lote AS loteSubReceta,
                sp.id AS idLote,
                smp.lote AS loteIngrediente,

                CASE 
                    WHEN ri.recetaRefId IS NOT NULL 
                        THEN IFNULL(sp.stock, 0)
                    ELSE 
                        IFNULL(smp.stock, 0)
                END AS stockReal,

                CASE 
                    WHEN ri.recetaRefId IS NOT NULL 
                        THEN IFNULL(sp.stock, 0)
                    ELSE 
                        IFNULL(smp.stock * i.factorConversion, 0)
                END AS stockReceta,

                i.factorConversion,

                uc.abreviatura AS unidadCompraAbrev,
                ur.abreviatura AS unidadRecetaAbrev,
                re.nombre AS receta,
                re.rinde AS rindeReceta,
                re.costoProduccion AS costoReceta,
                um.abreviatura AS unidadReceta,
                ri.recetaRefId,
                ri.ingredienteId,

                CASE 
                    WHEN ri.recetaRefId IS NOT NULL THEN 'receta'
                    ELSE 'ingrediente'
                END AS tipo

            FROM recetaingrediente ri

            LEFT JOIN ingrediente i 
                ON ri.ingredienteId = i.id

            LEFT JOIN unidadmedida u 
                ON i.unidadRecetaId = u.id

            LEFT JOIN unidadmedida uc 
                ON i.unidadCompraId = uc.id

            LEFT JOIN unidadmedida ur 
                ON i.unidadRecetaId = ur.id

            LEFT JOIN (
                SELECT id AS stockMPId, ingredienteId, depositoId, cantidad, lote
                FROM stockmateriaprima
                WHERE depositoId = ?
            ) smp
            ON i.id = smp.ingredienteId

            LEFT JOIN (
                SELECT id AS stockProductoId, productoId, depositoId, cantidad, lote
                FROM stockproducto
                WHERE depositoId = ?
            ) sp
            ON ri.recetaRefId = sp.productoId

            LEFT JOIN receta re
                ON ri.recetaRefId = re.id

            LEFT JOIN unidadmedida um
                ON re.unidadRindeId = um.id

            WHERE ri.recetaId = ?
        `, [depositoId, depositoId, id]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener ingredientes" });
    }
});

app.delete('/receta-ingrediente/receta/:recetaId', async (req, res) => {
    const { recetaId } = req.params
    await db.query(`
        DELETE FROM recetaingrediente
        WHERE recetaId = ?
    `, [recetaId])
    res.json({ message: "Ingredientes eliminados" })
})
// --------------------
// CREAR RECETA
// --------------------

app.post('/recetas', async (req,res)=>{
    try{

        const { nombre, rinde, unidadRindeId, costoProduccion } = req.body;

        const [result] = await db.query(`
            INSERT INTO receta
            (nombre, generaIngrediente, rinde, unidadRindeId, costoProduccion)
            VALUES (?,0,?,?,?)
        `,[nombre,rinde,unidadRindeId,costoProduccion]);

        res.json({
            message:"Receta creada",
            recetaId: result.insertId
        });

    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al crear receta" });
    }
});


// --------------------
// AGREGAR INGREDIENTE A RECETA
// --------------------

app.post('/receta-ingrediente', async (req,res)=>{
    try{

        const { recetaId, ingredienteId, recetaRefId, cantidad } = req.body;

        // ⚠️ validación básica
        if(!recetaId || !cantidad){
            return res.status(400).json({error:"Datos incompletos"})
        }

        // 🚫 evitar doble uso
        if(ingredienteId && recetaRefId){
            return res.status(400).json({error:"No puede ser ingrediente y receta al mismo tiempo"})
        }

        if(!ingredienteId && !recetaRefId){
            return res.status(400).json({error:"Debe enviar ingredienteId o recetaRefId"})
        }
        console.log("BODY:", req.body);
        console.log({
            recetaId,
            ingredienteId,
            recetaRefId,
            cantidad
        });
        // 🧠 INSERT dinámico
        if(recetaRefId != null){
            // 👉 es una sub-receta
            await db.query(`
                INSERT INTO recetaingrediente
                (recetaId, recetaRefId, cantidad)
                VALUES (?,?,?)
            `,[recetaId, recetaRefId, cantidad])

        }else{
            // 👉 es un ingrediente normal
            await db.query(`
                INSERT INTO recetaingrediente
                (recetaId, ingredienteId, cantidad)
                VALUES (?,?,?)
            `,[recetaId, ingredienteId, cantidad])
        }

        res.json({
            message:"Elemento agregado a receta"
        });

    }catch(error){
        console.error(error);
        res.status(500).json({ error: "Error al agregar elemento" });
    }
});
app.put('/recetas/:id', async (req,res)=>{
    const { id } = req.params
    const { nombre, rinde, unidadRindeId, costoProduccion,generaIngrediente  } = req.body

    await db.query(`
        UPDATE receta 
        SET nombre=?, rinde=?, unidadRindeId=?, costoProduccion=?,generaIngrediente=?
        WHERE id=?
    `,[nombre, rinde, unidadRindeId, costoProduccion, generaIngrediente, id])

    res.json({message:"ok"})
})
app.delete('/receta-ingrediente/:id', async (req,res)=>{
    const { id } = req.params

    await db.query(`
        DELETE FROM recetaingrediente
        WHERE id = ?
    `,[id])

    res.json({message:"Ingrediente eliminado"})
})

app.delete('/recetas/:id', async (req, res) => {
    const { id } = req.params
    const connection = await db.getConnection()
    try {
        await connection.beginTransaction()
        // 🔥 VALIDACIÓN (VA ACÁ)
        const [usos] = await connection.query(`
            SELECT id 
            FROM recetaingrediente
            WHERE recetaRefId = ?
        `, [id])
        if(usos.length > 0){
            throw new Error("No se puede eliminar: esta receta está siendo usada en otras")
        }
        // 🔹 eliminar ingredientes de la receta
        await connection.query(`
            DELETE FROM recetaingrediente
            WHERE recetaId = ?
        `, [id])
        // 🔹 eliminar receta
        const [result] = await connection.query(`
            DELETE FROM receta
            WHERE id = ?
        `, [id])
        if(result.affectedRows === 0){
            throw new Error("Receta no encontrada")
        }
        await connection.commit()
        res.json({ message: "Receta eliminada correctamente" })
    } catch (error) {
        await connection.rollback()
        console.error(error)
        res.status(400).json({ 
            error: error.message || "Error al eliminar receta" 
        })
    } finally {
        connection.release()
    }
})

app.get('/receta/:id', async (req,res)=>{
    try{

        const { id } = req.params

        const [rows] = await db.query(`
            SELECT 
                id,
                nombre,
                rinde,
                unidadRindeId,
                generaIngrediente
            FROM receta
            WHERE id = ?
        `,[id])

        res.json(rows[0])

    }catch(error){
        console.error(error)
        res.status(500).json({error:"Error al obtener receta"})
    }
})


app.post('/produccion', async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        // 1. Extraer TODO al principio para evitar errores de referencia
        const { 
            recetaId, 
            depositoOrigenId, 
            depositoDestinoId, 
            lotes, 
            fechaProduccion, 
            fechaVencimiento,
            lotesSeleccionados,
            desperdicioCantidad
        } = req.body;
        console.log("📦 Datos recibidos:", req.body);

        await connection.beginTransaction();

        // 2. Obtener datos de la receta
        const [recetaData] = await connection.query(
            "SELECT nombre, rinde, costoProduccion, unidadRindeId  FROM receta WHERE id = ?", 
            [recetaId]
        );
        
        if (recetaData.length === 0) throw new Error("La receta no existe");
        
        const { nombre, rinde, costoProduccion } = recetaData[0];
        const cantidadTotal = rinde * lotes;
        const desperdicio = Number(desperdicioCantidad || 0);
        const cantidadReal = cantidadTotal - desperdicio;
        const costoTotalLote = costoProduccion * lotes;
        const costoUnitario = cantidadReal > 0 
            ? (costoTotalLote / cantidadReal) 
            : (costoProduccion / rinde);
        const numeroLote = `LOT-${recetaId}-${Date.now().toString().slice(-4)}`;

        // 3. Obtener ingredientes
        const [items] = await connection.query(`
            SELECT 
                ri.ingredienteId,
                ri.recetaRefId,
                ri.cantidad,
                i.factorConversion,
                COALESCE(i.nombre, r.nombre) as ingredienteNombre
            FROM recetaingrediente ri
            LEFT JOIN ingrediente i 
                ON ri.ingredienteId = i.id
            LEFT JOIN receta r
                ON ri.recetaRefId = r.id
            WHERE ri.recetaId = ?
        `, [recetaId]);
        for (const item of items) {
        console.log("Ingrediente evaluado:", item);
            const totalNecesario = item.cantidad * lotes;

            // Si es una sub-receta (receta que se usa como ingrediente)
if (item.recetaRefId) {
    const loteInfo = lotesSeleccionados[item.ingredienteNombre];

    if (!loteInfo || !Array.isArray(loteInfo) || loteInfo.length === 0) {
        throw new Error(`Falta seleccionar lote para: ${item.ingredienteNombre}`);
    }

    // ✅ Iterar cada lote seleccionado
    for (const { lote, cantidad } of loteInfo) {
        const [stockExistente] = await connection.query(`
            SELECT sp.id, sp.cantidad
            FROM stockproducto sp
            INNER JOIN productoterminado pt ON sp.productoId = pt.id
            WHERE pt.recetaId = ? 
            AND sp.lote = ? 
            AND sp.depositoId = ?
            LIMIT 1
        `, [item.recetaRefId, lote, depositoOrigenId]);

        if (stockExistente.length === 0) {
            throw new Error(`No hay stock del lote ${lote} para ${item.ingredienteNombre}`);
        }

        if (stockExistente[0].cantidad < cantidad) {
            throw new Error(`Stock insuficiente en lote ${lote} de ${item.ingredienteNombre}. Disponible: ${stockExistente[0].cantidad}, Querés usar: ${cantidad}`);
        }

        await connection.query(
            "UPDATE stockproducto SET cantidad = cantidad - ? WHERE id = ?",
            [cantidad, stockExistente[0].id]
        );
    }
}
            if (item.ingredienteId) {
                const cantidadARestar =
                    totalNecesario / (item.factorConversion ?? 1)

                const [stockMP] = await connection.query(`
                    SELECT id, cantidad
                    FROM stockmateriaprima
                    WHERE ingredienteId = ?
                    AND depositoId = ?
                    LIMIT 1
                `, [item.ingredienteId, depositoOrigenId])

                if (stockMP.length === 0) {
                    throw new Error(
                        `No hay stock disponible de ${item.ingredienteNombre}`
                    )
                }

                const stockItem = stockMP[0]

                if (stockItem.cantidad < cantidadARestar) {
                    throw new Error(
                        `Stock insuficiente de ${item.ingredienteNombre}`
                    )
                }

                await connection.query(`
                    UPDATE stockmateriaprima
                    SET cantidad = cantidad - ?
                    WHERE id = ?
                `, [cantidadARestar, stockItem.id])
            }
        }

        // 4. Registro y actualización de producto terminado
        // (Tus pasos 3, 4 y 5 se mantienen aquí...)
        
        if (desperdicioCantidad < 0) {
            throw new Error("El desperdicio no puede ser negativo");
        }

        if (desperdicioCantidad > cantidadTotal) {
            throw new Error("El desperdicio no puede ser mayor a la producción");
        }
        
        await connection.query(`
            INSERT INTO produccionregistro 
            (
                recetaId, 
                depositoId, 
                numeroLote, 
                cantidad, 
                desperdicioCantidad,
                desperdicioUnidadId,
                fechaProduccion, 
                fechaVencimiento, 
                costoTotal
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            recetaId,
            depositoDestinoId,
            numeroLote,
            cantidadReal, // 🔥 USAR REAL
            desperdicio,
            recetaData[0].unidadRindeId, // 🔥 MISMA UNIDAD DE LA RECETA
            fechaProduccion,
            fechaVencimiento || null,
            costoTotalLote
        ]);
        await connection.query(`
            INSERT INTO productoterminado (recetaId, nombre, lote, costoUnitario)
            VALUES (?, ?, ?, ?)
        `, [recetaId, nombre, numeroLote, costoUnitario]);

        await connection.query(`
            INSERT INTO stockproducto (productoId, depositoId, cantidad, lote)
            VALUES (LAST_INSERT_ID(), ?, ?, ?)
        `, [depositoDestinoId, cantidadReal, numeroLote]);

        await connection.commit();
        res.json({ success: true, message: "Producción realizada", lote: numeroLote });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ ERROR EN PRODUCCION:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// app.post('/producc', async (req,res)=>{
//     try {

//         console.log("\n========== 🚀 NUEVA PREVIEW PRODUCCIÓN ==========");

//         // 🔹 1. BODY
//         console.log("📦 BODY:");
//         console.log(JSON.stringify(req.body, null, 2));

//         const {
//             recetaId,
//             depositoOrigenId,
//             lotes
//         } = req.body;

//         console.log("📌 Params:", { recetaId, depositoOrigenId, lotes });

//         // 🔹 2. QUERY INGREDIENTES
//         const [items] = await db.query(`
//             SELECT 
//                 ri.ingredienteId,
//                 ri.recetaRefId,
//                 ri.cantidad,
//                 i.nombre AS ingredienteNombre,
//                 r2.nombre AS recetaNombre
//             FROM recetaingrediente ri
//             LEFT JOIN ingrediente i ON ri.ingredienteId = i.id
//             LEFT JOIN receta r2 ON ri.recetaRefId = r2.id
//             WHERE ri.recetaId = ?
//         `, [recetaId]);

//         console.log("🧾 ITEMS DE LA RECETA:");
//         console.log(items);

//         const resultado = [];

//         // 🔹 3. LOOP
//         for (const item of items) {

//             console.log("\n------------------------------");

//             const total = item.cantidad * lotes;

//             console.log("🔍 ITEM:", item);
//             console.log("📊 Cantidad base:", item.cantidad);
//             console.log("📦 Lotes:", lotes);
//             console.log("➡️ Total necesario:", total);

//             // 🟢 INGREDIENTE NORMAL
//             if (item.ingredienteId) {

//                 console.log("🟢 Tipo: INGREDIENTE");

//                 const [stock] = await db.query(`
//                     SELECT cantidad 
//                     FROM stockmateriaprima
//                     WHERE ingredienteId = ? AND depositoId = ?
//                 `, [item.ingredienteId, depositoOrigenId]);

//                 console.log("📥 STOCK DB:", stock);

//                 resultado.push({
//                     tipo: "ingrediente",
//                     nombre: item.ingredienteNombre,
//                     cantidadNecesaria: total,
//                     stockDisponible: stock[0]?.cantidad ?? 0
//                 });
//             }

//             // 🔵 SUBRECETA
//             if (item.recetaRefId) {

//                 console.log("🔵 Tipo: SUBRECETA");
//                 console.log("📛 Nombre:", item.recetaNombre);

//                 const [lotesStock]= await db.query(`
//                     SELECT sp.lote, sp.cantidad
//                     FROM stockproducto sp
//                     INNER JOIN productoterminado pt 
//                         ON sp.productoId = pt.id
//                     WHERE pt.recetaId = ?
//                     AND sp.depositoId = ?
//                 `, [item.recetaRefId, depositoOrigenId]);

//                 console.log("📦 LOTES DISPONIBLES:", lotesStock);

//                 resultado.push({
//                     tipo: "receta",
//                     nombre: item.recetaNombre,
//                     cantidadNecesaria: total,
//                     lotesDisponibles: lotesStock
//                 });
//             }
//         }

//         // 🔹 4. RESULTADO FINAL
//         console.log("\n✅ RESULTADO FINAL:");
//         console.log(JSON.stringify(resultado, null, 2));

//         console.log("========== ✅ FIN PREVIEW ==========\n");

//         res.json({
//             message: "Preview generado",
//             data: resultado
//         });

//     } catch (error) {
//         console.log("❌ ERROR:");
//         console.log(error);
//         res.status(500).json({ error: "Error en preview" });
//     }
// });
// --------------------
// STOCK PRODUCTOS TERMINADOS
// --------------------

app.get('/stock-productos', async (req,res)=>{
    try{

        const [rows] = await db.query(`
            SELECT 
                p.id AS productoId,
                p.nombre AS producto,
                sp.lote,
                d.denominacion AS deposito,
                sp.cantidad,
                um.abreviatura,
                pr.fechaVencimiento,
                p.recetaId,
                p.costoUnitario,
                vd.precioUnitario,
                d.id AS depositoId,
                pr.fechaProduccion

            FROM stockproducto sp

            JOIN productoterminado p
                ON sp.productoId = p.id

            LEFT JOIN produccionregistro pr
                ON sp.lote = pr.numeroLote
                AND pr.recetaId = p.recetaId

            JOIN deposito d
                ON sp.depositoId = d.id

            LEFT JOIN receta re
                ON p.recetaId = re.id

            LEFT JOIN unidadmedida um
                ON re.unidadRindeId = um.id

            LEFT JOIN (
                SELECT 
                    productoId,
                    lote,
                    MAX(precioUnitario) AS precioUnitario
                FROM ventadetalle
                GROUP BY productoId, lote
            ) vd ON sp.productoId = vd.productoId AND sp.lote = vd.lote
            
            WHERE sp.cantidad > 0
              AND sp.lote IS NOT NULL
              AND TRIM(sp.lote) <> ''
            ORDER BY p.nombre ASC, sp.lote ASC
        `)

        res.json(rows)

    }catch(error){

        console.error(error)

        res.status(500).json({
            error:"Error al obtener stock de productos"
        })

    }
})
app.put('/produccion/:lote/fechas', async (req, res) => {
    try {
        const { lote } = req.params
        const { fechaProduccion, fechaVencimiento } = req.body

        if (!lote) {
            return res.status(400).json({ error: "Lote no enviado" })
        }

        if (!fechaProduccion) {
            return res.status(400).json({ error: "La fecha de producción es obligatoria" })
        }

        const fechaVencimientoFinal =
            fechaVencimiento && String(fechaVencimiento).trim() !== ""
                ? fechaVencimiento
                : null

        const [result] = await db.query(`
            UPDATE produccionregistro
            SET fechaProduccion = ?, fechaVencimiento = ?
            WHERE numeroLote = ?
        `, [fechaProduccion, fechaVencimientoFinal, lote])

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "No se encontró la producción para ese lote" })
        }

        res.json({ message: "Fechas actualizadas correctamente" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al actualizar fechas de la producción" })
    }
})
app.put('/stock-producto/mover', async (req, res) => {
    const connection = await db.getConnection()

    try {
        await connection.beginTransaction()

        const {
            productoId,
            lote,
            depositoOrigenId,
            depositoDestinoId,
            cantidad
        } = req.body

        // 🔴 VALIDACIÓN: mismo depósito
        if (depositoOrigenId === depositoDestinoId) {
            throw new Error("El depósito origen y destino no pueden ser iguales")
        }

        // 🔴 VALIDAR STOCK ORIGEN
        const [stock] = await connection.query(`
            SELECT id, cantidad
            FROM stockproducto
            WHERE productoId=? 
            AND lote=? 
            AND depositoId=?
            LIMIT 1
        `, [productoId, lote, depositoOrigenId])

        if (stock.length === 0) {
            throw new Error("No existe stock en depósito origen")
        }

        if (stock[0].cantidad < cantidad) {
            throw new Error("Stock insuficiente")
        }

        // 🟡 RESTAR EN ORIGEN
        await connection.query(`
            UPDATE stockproducto
            SET cantidad = cantidad - ?
            WHERE id = ?
        `, [cantidad, stock[0].id])

        // 🧹 ELIMINAR SI QUEDA EN 0
        await connection.query(`
            DELETE FROM stockproducto
            WHERE id = ? AND cantidad <= 0
        `, [stock[0].id])

        // 🟢 INSERTAR / SUMAR EN DESTINO
        await connection.query(`
            INSERT INTO stockproducto (productoId, depositoId, cantidad, lote)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cantidad = cantidad + VALUES(cantidad)
        `, [productoId, depositoDestinoId, cantidad, lote])

        await connection.commit()

        res.json({ message: "Producto movido correctamente" })

    } catch (error) {
        await connection.rollback()
        console.error(error)

        res.status(500).json({
            error: error.message
        })
    } finally {
        connection.release()
    }
})
app.delete('/produccion/:lote', async (req,res)=>{

const connection = await db.getConnection()


// 🔥 FUNCIÓN CORREGIDA
const devolverReceta = async (
recetaId,
lotes,
depositoId,
factorRecuperacion = 1
)=>{

const [items] = await connection.query(`
SELECT 
ri.ingredienteId,
ri.recetaRefId,
ri.cantidad,
i.factorConversion
FROM recetaingrediente ri
LEFT JOIN ingrediente i
ON ri.ingredienteId = i.id
WHERE ri.recetaId = ?
`,[recetaId])


for(const item of items){

const devolverBase = Number(item.cantidad) * Number(lotes)
const devolver = devolverBase * Number(factorRecuperacion)

if(devolver <= 0){
continue
}

// 🟢 INGREDIENTE BASE
if(item.ingredienteId){

const cantidadFinal =
devolver / (item.factorConversion ?? 1)


await connection.query(`
INSERT INTO stockmateriaprima
(ingredienteId, depositoId, cantidad)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
cantidad = cantidad + VALUES(cantidad)
`,[
item.ingredienteId,
depositoId,
cantidadFinal
])

}


// 🔵 SUBRECETA → devolver como PRODUCTO TERMINADO + REGISTRO
if(item.recetaRefId){

const [subreceta] = await connection.query(`
SELECT
id,
nombre,
rinde,
unidadRindeId,
costoProduccion
FROM receta
WHERE id = ?
LIMIT 1
`,[item.recetaRefId])

if(subreceta.length === 0){
throw new Error(
`No existe la subreceta ${item.recetaRefId}`
)
}

const datosSubreceta = subreceta[0]

const nuevoLote =
`DEV-${item.recetaRefId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const costoUnitario = Number(datosSubreceta.rinde) > 0
? Number(datosSubreceta.costoProduccion ?? 0) / Number(datosSubreceta.rinde)
: 0

const costoTotal = costoUnitario * devolver

const [productoInsert] = await connection.query(`
INSERT INTO productoterminado
(recetaId, nombre, lote, costoUnitario)
VALUES (?, ?, ?, ?)
`,[
datosSubreceta.id,
datosSubreceta.nombre,
nuevoLote,
costoUnitario
])

await connection.query(`
INSERT INTO produccionregistro
(
recetaId,
depositoId,
numeroLote,
cantidad,
desperdicioCantidad,
desperdicioUnidadId,
fechaProduccion,
fechaVencimiento,
costoTotal
)
VALUES (?, ?, ?, ?, ?, ?, NOW(), NULL, ?)
`,[
datosSubreceta.id,
depositoId,
nuevoLote,
devolver,
0,
datosSubreceta.unidadRindeId,
costoTotal
])

await connection.query(`
INSERT INTO stockproducto
(productoId, depositoId, lote, cantidad)
VALUES (?, ?, ?, ?)
`,[
productoInsert.insertId,
depositoId,
nuevoLote,
devolver
])

}

}

}



try{

await connection.beginTransaction()


const { lote } = req.params


// 🔴 VALIDAR SI YA SE VENDIÓ
const [ventas] = await connection.query(`
SELECT id
FROM ventadetalle
WHERE lote = ?
`,[lote])


if(ventas.length > 0){

throw new Error(
"No se puede eliminar: el lote ya fue vendido"
)

}


// 🟡 VALIDAR STOCK
const [stock] = await connection.query(`
SELECT id
FROM stockproducto
WHERE lote = ?
`,[lote])


if(stock.length === 0){

throw new Error(
"El lote no existe en stock"
)

}


// 🟢 OBTENER PRODUCCIÓN
const [prod] = await connection.query(`
SELECT
recetaId,
cantidad,
depositoId,
desperdicioCantidad
FROM produccionregistro
WHERE numeroLote = ?
`,[lote])


if(prod.length === 0){

throw new Error(
"Producción no encontrada"
)

}


const {
recetaId,
cantidad,
depositoId,
desperdicioCantidad
} = prod[0]


// 🟢 OBTENER RINDE
const [receta] = await connection.query(`
SELECT rinde
FROM receta
WHERE id = ?
`,[recetaId])


if(receta.length === 0){

throw new Error(
"Receta no encontrada"
)

}


const rinde =
receta[0].rinde


if(rinde === 0){

throw new Error(
"Rinde inválido en receta"
)

}


const cantidadProducida = Number(cantidad || 0)
const desperdicioOriginal = Number(desperdicioCantidad || 0)
const cantidadTotalProceso = cantidadProducida + desperdicioOriginal

const lotesOriginales =
rinde > 0 ? (cantidadTotalProceso / rinde) : 0

const factorRecuperacion =
cantidadTotalProceso > 0 ? (cantidadProducida / cantidadTotalProceso) : 0


// 🔥 DEVOLVER SUBRECETAS E INGREDIENTES SEGÚN LO REALMENTE RECUPERABLE
await devolverReceta(
recetaId,
lotesOriginales,
depositoId,
factorRecuperacion
)


// 🗑️ BORRAR STOCK PRODUCTO
await connection.query(`
DELETE FROM stockproducto
WHERE lote = ?
`,[lote])


// 🗑️ BORRAR PRODUCTO TERMINADO
await connection.query(`
DELETE FROM productoterminado
WHERE lote = ?
`,[lote])


// 🗑️ BORRAR PRODUCCIÓN
await connection.query(`
DELETE FROM produccionregistro
WHERE numeroLote = ?
`,[lote])


await connection.commit()


res.json({
message:"Producción eliminada correctamente"
})


}catch(error){

await connection.rollback()

console.error(
"❌ ERROR AL ELIMINAR PRODUCCIÓN:",
error.message
)

res.status(500).json({
error:error.message
})

}
finally{

connection.release()

}

})
app.get('/productos-catalogo', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                re.id AS recetaId,
                re.nombre AS producto,
                um.abreviatura,
                re.costoProduccion,
                re.rinde,
                MAX(vd.precioUnitario) AS ultimoPrecio,
                MAX(v.fecha) AS ultimaVenta
            FROM receta re
            LEFT JOIN unidadmedida um
                ON re.unidadRindeId = um.id
            LEFT JOIN productoterminado pt
                ON pt.recetaId = re.id
            LEFT JOIN ventadetalle vd
                ON vd.productoId = pt.id
            LEFT JOIN venta v
                ON vd.ventaId = v.id
            GROUP BY re.id, re.nombre, um.abreviatura, re.costoProduccion, re.rinde
            ORDER BY re.nombre ASC
        `)
        res.json(rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al obtener catálogo de productos" })
    }
})
// --------------------
// CREAR VENTA
// --------------------

app.post('/ventas/nueva', async (req,res)=>{

    const { depositoId, productos, total } = req.body
    const connection = await db.getConnection()
    try{
        await connection.beginTransaction()
        // 1️⃣ crear venta
        const [venta] = await connection.query(`
            INSERT INTO venta
            (fecha, depositoId, totalGeneral)
            VALUES (NOW(), ?, ?)
        `,[depositoId,total])
        const ventaId = venta.insertId
        // 2️⃣ guardar productos vendidos
        for(const p of productos){
            await connection.query(`
                INSERT INTO ventadetalle
                (ventaId, productoId, lote, cantidad, precioUnitario, subtotal)
                VALUES (?,?,?,?,?,?)
            `,[
                ventaId,
                p.productoId,
                p.lote,
                p.cantidad,
                p.precio,
                p.subtotal
            ])
            await connection.query(`
                UPDATE stockproducto
                SET cantidad = cantidad - ?
                WHERE productoId = ? AND lote = ? AND depositoId = ?
            `,[
                p.cantidad,
                p.productoId,
                p.lote,
                depositoId
            ])
        }


        await connection.commit()

        res.json({
            message:"Venta registrada"
        })

    }catch(error){

        await connection.rollback()

        console.log(error)

        res.status(500).json({
            error:"Error al registrar venta"
        })

    }finally{

        connection.release()

    }

})



// --------------------
// HISTORIAL DE VENTAS
// --------------------

app.get('/ventas', async (req,res)=>{

    try{

        const [rows] = await db.query(`
            SELECT 
                v.fecha,
                d.denominacion AS deposito,
                v.totalGeneral AS total,

                p.nombre AS producto,
                vd.lote,
                vd.cantidad,
                
                um.abreviatura AS unidad,  -- 🔥 ESTO QUERÍAS

                vd.precioUnitario,
                vd.subtotal

            FROM venta v

            JOIN deposito d 
                ON v.depositoId = d.id

            JOIN ventadetalle vd 
                ON v.id = vd.ventaId

            JOIN productoterminado p 
                ON vd.productoId = p.id

            LEFT JOIN receta r
                ON p.recetaId = r.id

            LEFT JOIN unidadmedida um
                ON r.unidadRindeId = um.id

            ORDER BY v.fecha DESC
        `)

        res.json(rows)

    }catch(error){

        console.log(error)

        res.status(500).json({
            error:"Error al obtener ventas"
        })

    }

})

// --------------------
// login


app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 🔴 validar datos
        if (!username || !password) {
            return res.status(400).json({ error: "Faltan datos" });
        }

        // 🔍 buscar usuario
        const [rows] = await db.query(
            `SELECT id, username, password 
                FROM usuarios 
                WHERE username = ?`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Usuario no existe" });
        }

        const user = rows[0];

        // 🔐 validar password (simple, después podés usar bcrypt)
        if (user.password !== password) {
            return res.status(400).json({ error: "Contraseña incorrecta" });
        }

        // 🎟️ generar token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            SECRET,
            { expiresIn: "8h" }
        );

        // ✅ respuesta
        res.json({
            message: "Login correcto",
            token,
            listadoId: user.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en login" });
    }
});




// --------------------
// COMPRA
// --------------------

app.post('/compras', async(req,res)=>{
    const {fecha}=req.body
    try{
        const [result] = await db.query(`
            INSERT INTO compras
            (fecha, proveedor)
            VALUES (?,'-')
        `,[fecha])
        res.json({
            message:"registro de compras creada",
            id: result.insertId
        })
    }catch(error){
        console.error(error)
        res.status(500).json({
            error:"Error al crear registro de compras"
        })
    }
})
app.post('/compras_detalle', async (req, res) => {
    const { ingredienteId, depositoId, cantidad, costo, compraId } = req.body

    try {
        // 1. Guardar detalle
        await db.query(`
            INSERT INTO compras_detalle 
            (compra_id, ingrediente_id, cantidad, costo,deposito_id)
            VALUES (?, ?, ?, ?,?)
        `, [compraId,ingredienteId, cantidad, costo,depositoId])

        // 2. Actualizar stock (POR DEPÓSITO 🔥)
        await db.query(`
            INSERT INTO stockmateriaprima (ingredienteId, depositoId, cantidad)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            cantidad = cantidad + VALUES(cantidad)
        `, [ingredienteId, depositoId, cantidad])

        res.json({ message: "Compra registrada y stock actualizado" })

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Error al guardar compra" })
    }
})
app.delete('/compra-detalle/:id', async (req, res) => {
    const connection = await db.getConnection()

    try {
        await connection.beginTransaction()

        const { id } = req.params

        if (!id) {
            throw new Error("ID no enviado")
        }

        // 🔍 Obtener detalle de compra
        const [detalle] = await connection.query(`
            SELECT ingrediente_id, deposito_id, cantidad
            FROM compras_detalle
            WHERE id = ?
        `, [id])

        if (detalle.length === 0) {
            throw new Error("Compra no encontrada")
        }

        const { ingrediente_id, deposito_id, cantidad } = detalle[0]

        // 🔍 Verificar stock actual
        const [stock] = await connection.query(`
            SELECT id, cantidad
            FROM stockmateriaprima
            WHERE ingredienteId = ?
            AND depositoId = ?
            LIMIT 1
        `, [ingrediente_id, deposito_id])

        if (stock.length === 0) {
            throw new Error("No hay stock para descontar")
        }

        if (Number(stock[0].cantidad) < Number(cantidad)) {
            throw new Error("No se puede eliminar la compra porque el stock sería negativo")
        }

        // 🔻 Restar stock
        await connection.query(`
            UPDATE stockmateriaprima
            SET cantidad = cantidad - ?
            WHERE id = ?
        `, [cantidad, stock[0].id])

        // 🗑️ Eliminar compra
        await connection.query(`
            DELETE FROM compras_detalle
            WHERE id = ?
        `, [id])

        await connection.commit()

        res.json({ message: "Compra eliminada correctamente" })

    } catch (error) {
        await connection.rollback()
        console.error(error)

        res.status(500).json({
            error: error.message
        })
    } finally {
        connection.release()
    }
})
app.get('/compra', async(req,res)=>{
    try {
        const [rows]= await db.query(`
            SELECT 
            cd.id,
            cd.cantidad,
            cd.costo,
            c.fecha,
            i.nombre,
            d.denominacion AS nombre_deposito,
            cd.deposito_id

            FROM compras_detalle cd
            LEFT JOIN compras c

            on cd.compra_id = c.id
            LEFT JOIN ingrediente i
            on cd.ingrediente_id = i.id
            LEFT JOIN deposito d
            ON cd.deposito_id = d.id
        `)
            res.json(rows)
    } catch (error) {
        console.log(error)
        res.status(500).json({
            error:"Error al obtener detalle de compras"
        })
    }
})



// START SERVER
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} 🚀`);
});