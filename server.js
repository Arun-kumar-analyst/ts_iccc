const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use(express.json());

/* UPLOAD FOLDER */
const uploadFolder = "uploads";

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

app.use(express.static("public"));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


/* MULTER CONFIG */

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },

    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }

});

const upload = multer({ storage: storage });


// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Root route → open index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const pool = new Pool({
    user: "jay_admin",
    //  default localhost
    host: "dpg-d6qg74lm5p6s73e2gg00-a.singapore-postgres.render.com", 
    database: "tgiccc_db",
    password: "cIHGC3A3HXt4F9xNPUZEzQil6luKI6Do",
    port: 5432,
    connectionString: process.env.DATABASE_URL || "postgresql://jay_admin:cIHGC3A3HXt4F9xNPUZEzQil6luKI6Do@dpg-d6qg74lm5p6s73e2gg00-a.singapore-postgres.render.com/tgiccc_db",
    ssl: {
    rejectUnauthorized: false // Cloud deployment ki idi chala important
    }
});

/* SAVE SHIFT */

app.post("/api/shift", async (req, res) => {

    const {
        shift_type,
        shift_name,
        start_time,
        end_time,
        place_name,
        incharge_name,
        phone_no,
        extension_no,
        total_staff,
        staff_names,
        emergency_contact,
        vehicles_deployed,
        active_cases
    } = req.body;

    try {

        await pool.query(
            `INSERT INTO shift
(shift_type,shift_name,start_time,end_time,place_name,
incharge_name,phone_no,extension_no,total_staff,
staff_names,emergency_contact,vehicles_deployed,active_cases)

VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,

            [
                shift_type,
                shift_name,
                start_time,
                end_time,
                place_name,
                incharge_name,
                phone_no,
                extension_no,
                total_staff,
                staff_names,
                emergency_contact,
                vehicles_deployed,
                active_cases
            ]

        );

        res.json({ message: "Shift saved" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }

});


/* CURRENT SHIFT */

app.get("/api/shift/current", async (req, res) => {

    try {

        const result = await pool.query(

            `SELECT *
             FROM shift
             WHERE CURRENT_TIME BETWEEN start_time AND end_time
             ORDER BY id DESC
             LIMIT 1`

        );

        if (result.rows.length === 0) {

            return res.status(404).json({ message: "No active shift" });

        }

        res.json(result.rows[0]);

    } catch (err) {

        console.log(err);
        res.status(500).json({ message: "Server error" });

    }

});

/* SHIFT HISTORY */

app.get("/api/shift/history", async (req, res) => {

    const result = await pool.query(
        `SELECT * FROM shift ORDER BY created_at DESC`
    );

    res.json(result.rows);

});



/* REGISTER */

app.post("/register", async (req, res) => {

    try {

        const { employee_id, password } = req.body;

        const check = await pool.query(
            "SELECT * FROM users_login WHERE employee_id=$1",
            [employee_id]
        );

        if (check.rows.length > 0) {

            return res.json({
                success: false,
                message: "User already registered"
            });

        }

        const hash = await bcrypt.hash(password, 10);

        await pool.query(
            "INSERT INTO users_login(employee_id,password) VALUES($1,$2)",
            [employee_id, hash]
        );

        res.json({
            success: true,
            message: "Registration successful"
        });

    }
    catch (err) {

        console.log(err);

        res.json({
            success: false,
            message: "Server error"
        });

    }

});


/* LOGIN */

app.post("/login", async (req, res) => {

    try {

        const { employee_id, password } = req.body;

        const user = await pool.query(
            "SELECT * FROM users_login WHERE employee_id=$1",
            [employee_id]
        );

        if (user.rows.length === 0) {

            return res.json({
                success: false,
                message: "User not found"
            });

        }

        const valid = await bcrypt.compare(
            password,
            user.rows[0].password
        );

        if (!valid) {

            return res.json({
                success: false,
                message: "Invalid password"
            });

        }

        res.json({
            success: true,
            message: "Login successful"
        });

    }
    catch (err) {

        console.log(err);

        res.json({
            success: false
        });

    }

});


/* FORGOT PASSWORD */

app.post("/forgot-password", async (req, res) => {

    try {

        const { employee_id, newpassword } = req.body;

        const user = await pool.query(
            "SELECT * FROM users_login WHERE employee_id=$1",
            [employee_id]
        );

        if (user.rows.length === 0) {

            return res.json({
                success: false,
                message: "User not found"
            });

        }

        const hash = await bcrypt.hash(newpassword, 10);

        await pool.query(
            "UPDATE users_login SET password=$1 WHERE employee_id=$2",
            [hash, employee_id]
        );

        res.json({
            success: true,
            message: "Password updated successfully"
        });

    }
    catch (err) {

        console.log(err);

        res.json({
            success: false
        });

    }

});


/* NOTICES */

/* GET notices */

app.get("/api/notices", async (req, res) => {

    const result = await pool.query(
        "SELECT * FROM notices ORDER BY created_dt DESC"
    );

    res.json(result.rows);

});

/* CREATE notice */

app.post("/api/notices", async (req, res) => {

    const { title, content, priority } = req.body;

    const result = await pool.query(

        `INSERT INTO notices(title,content,priority)
 VALUES($1,$2,$3)
 RETURNING *`,

        [title, content, priority]

    );

    res.json(result.rows[0]);

});

/* UPDATE notice */

app.put("/api/notices/:id", async (req, res) => {

    const id = req.params.id;

    const { title, content, priority } = req.body;

    await pool.query(

        `UPDATE notices
 SET title=$1,
     content=$2,
     priority=$3,
     updated_dt=CURRENT_TIMESTAMP
 WHERE id=$4`,

        [title, content, priority, id]

    );

    res.json({ status: "updated" });

});

/* DELETE notice */

app.delete("/api/notices/:id", async (req, res) => {

    const id = req.params.id;

    await pool.query(
        "DELETE FROM notices WHERE id=$1",
        [id]
    );

    res.json({ status: "deleted" });

});


/* INCIDENTS */

/* API to insert incident */



/* SAVE INCIDENT */




app.post("/reportIncident", upload.single("file"), async (req, res) => {

    try {

        let {
            incident_id,
            category,
            title,
            district,
            location,
            severity,
            crowd_size,
            resources,
            description,
            contact,
            reported_by,
            reported_time,
            assigned_to
        } = req.body;

        // Fix timestamp
        if (!reported_time || reported_time.trim() === "") {
            reported_time = null;
        }

        let file_path = null;

        if (req.file) {
            file_path = "uploads/" + req.file.filename;
        }

        const query = `
        INSERT INTO incidents (
            incident_id,
            category,
            title,
            district,
            location,
            severity,
            crowd_size,
            resources,
            description,
            contact,
            reported_by,
            reported_time,
            assigned_to,
            file_path,
            status
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'OPEN'
        )
        `;

        const values = [
            incident_id,
            category,
            title,
            district,
            location,
            severity,
            crowd_size,
            resources,
            description,
            contact,
            reported_by,
            reported_time,
            assigned_to,
            file_path
        ];

        await pool.query(query, values);

        res.json({
            success: true,
            message: "Incident saved successfully"
        });

    } catch (err) {

        console.error("Error saving incident:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/* GET INCIDENTS */

app.get("/incidents", async (req, res) => {

    try {

        const result = await pool.query(`
SELECT
incident_id,
category,
title,
district,
location,
severity,
crowd_size,
resources,
description,
contact,
reported_by,
assigned_to,
status,
file_path,
TO_CHAR(reported_time,'DD Mon YYYY HH12:MI AM') AS reported_time
FROM incidents
ORDER BY reported_time DESC
`);

        res.json(result.rows);

    } catch (err) {

        console.log(err);
        res.status(500).json({ error: "Server error" });

    }

});

/* UPDATE STATUS */

app.post("/updateStatus", async (req, res) => {

    try {

        const { incident_id, status } = req.body;

        await pool.query(
            "UPDATE incidents SET status=$1 WHERE incident_id=$2",
            [status, incident_id]
        );

        res.json({ success: true });

    } catch (err) {

        console.log(err);
        res.json({ success: false });

    }

});



// ================= CREATE EVENT =================

/* GET */
app.get("/api/events", async (req, res) => {
    const result = await pool.query("SELECT * FROM events ORDER BY id DESC");
    res.json({ success: true, data: result.rows });
});

/* POST */
app.post("/api/events", async (req, res) => {
    const { title, description, date, time, location } = req.body;

    const result = await pool.query(
        "INSERT INTO events (title, description, event_date, event_time, location) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [title, description, date, time, location]
    );

    res.json({ success: true, data: result.rows[0] });
});

/* PUT */
app.put("/api/events/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, date, time, location } = req.body;

    await pool.query(
        "UPDATE events SET title=$1, description=$2, event_date=$3, event_time=$4, location=$5 WHERE id=$6",
        [title, description, date, time, location, id]
    );

    res.json({ success: true });
});

/* DELETE */
app.delete("/api/events/:id", async (req, res) => {
    const { id } = req.params;
    await pool.query("DELETE FROM events WHERE id=$1", [id]);
    res.json({ success: true });
});




/* =======================================================
   ================= GALLERY ROUTES ======================
   ======================================================= */

/* CREATE EVENT */
app.post("/events_t", upload.single("cover"), async (req, res) => {
    try {
        const { title, event_date } = req.body;
        const cover = req.file ? req.file.filename : null;

        const result = await pool.query(
            "INSERT INTO events_t (title, event_date, cover_image) VALUES ($1,$2,$3) RETURNING *",
            [title, event_date, cover]
        );

        res.json({ success: true, data: result.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

/* GET ALL EVENTS */
app.get("/events_t", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, COUNT(p.id) AS photo_count
            FROM events_t e
            LEFT JOIN photos p ON e.id = p.event_id
            GROUP BY e.id
            ORDER BY e.id DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

/* ===== GET PHOTOS ===== */
app.get("/photos/:eventId", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM photos WHERE event_id=$1 ORDER BY id DESC",
            [req.params.eventId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB error" });
    }
});

/* ===== UPLOAD PHOTOS ===== */
app.post("/upload-photo/:eventId", upload.array("photos", 20), async (req, res) => {
    try {
        const eventId = req.params.eventId;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        for (let file of req.files) {
            await pool.query(
                "INSERT INTO photos (event_id, image_path) VALUES ($1,$2)",
                [eventId, file.filename]
            );
        }

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});


// ===== UPLOAD API =====
/* ================= UPLOAD DOCUMENT ================= */


app.post("/upload-document", upload.single("pdf"), async (req, res) => {
    try {
        const { title, description } = req.body;
        const file = req.file;

        if (!title || !file) {
            return res.status(400).json({ message: "Title and file required" });
        }

        const fileSize = file.size; // in bytes

        await pool.query(
            `INSERT INTO documents (title, description, file_name, file_size)
             VALUES ($1, $2, $3, $4)`,
            [title, description, file.filename, fileSize]
        );

        res.json({ message: "Document uploaded successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

/* ================= GET DOCUMENTS ================= */
app.get("/documents", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id,
                    title,
                    description,
                    file_name,
                    file_size,
                    created_at
             FROM documents
             ORDER BY created_at DESC`
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});



/* ===== CREATE TASK ===== */

/* =========================
   GET ALL TASKS
========================= */
app.get("/tasks", async (req, res) => {
    const { status } = req.query;

    let query = "SELECT * FROM tasks ORDER BY id DESC";
    let values = [];

    if (status && status !== "ALL") {
        query = "SELECT * FROM tasks WHERE status=$1 ORDER BY id DESC";
        values = [status];
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
});

/* =========================
   CREATE TASK
========================= */
app.post("/tasks", async (req, res) => {
    try {
        const { title, description, due_date, assigned_to, priority } = req.body;

        if (!title || title.trim() === "") {
            return res.status(400).json({ error: "Title is required" });
        }

        const result = await pool.query(
            `INSERT INTO tasks (title, description, due_date, assigned_to, priority)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [title.trim(), description, due_date, assigned_to, priority]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

/* =========================
   UPDATE STATUS
========================= */
app.put("/tasks/:id/status", async (req, res) => {
    const { status } = req.body;
    const id = req.params.id;

    if (status === "COMPLETED") {
        await pool.query(
            `UPDATE tasks 
             SET status=$1,
                 completed_at=NOW(),
                 updated_at=NOW()
             WHERE id=$2`,
            [status, id]
        );
    } else {
        await pool.query(
            `UPDATE tasks 
             SET status=$1,
                 updated_at=NOW()
             WHERE id=$2`,
            [status, id]
        );
    }

    res.json({ message: "Status updated" });
});
/* =========================
   DELETE TASK
========================= */
app.delete("/tasks/:id", async (req, res) => {
    await pool.query("DELETE FROM tasks WHERE id=$1", [req.params.id]);
    res.json({ message: "Deleted" });
});



/* GET ALL DIRECTORIES */

/* GET DATA */

app.get("/directories", async (req, res) => {

    try {

        const result = await pool.query(`
SELECT
branch_name AS branch,
personnel_number AS personnel,
pcs,
rank,
alias_name AS alias,
phone_number AS phone,
email
FROM directory_personnel
ORDER BY branch_name
`)

        res.json(result.rows)

    } catch (err) {

        console.log(err)
        res.status(500).send("Database error")

    }

})

/* INSERT DATA */

app.post("/createDirectory", async (req, res) => {

    try {

        const { branch, personnel, pcs, rank, alias, phone, email } = req.body

        await pool.query(

            `INSERT INTO directory_personnel
(branch_name,personnel_number,pcs,rank,alias_name,phone_number,email)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,

            [branch, personnel, pcs, rank, alias, phone, email]

        )

        res.json({ message: "Directory saved" })

    } catch (err) {

        console.log(err)
        res.status(500).send("Insert error")

    }

})

/* DIRECTORY BRANCH COUNT */

app.get("/branchCounts", async (req, res) => {

    const result = await db.query(`
SELECT branch, COUNT(personnel) AS total_personnel
FROM directories
GROUP BY branch
`)

    res.json(result.rows)

})






/* UPDATE PASSOWRD PROFILE */

/* GET PROFILE */

app.get("/profile/:employee_id", async (req, res) => {

    const employee_id = req.params.employee_id

    const result = await pool.query(
        `SELECT employee_id,name,email,phone,department
 FROM users_data
 WHERE employee_id=$1`,
        [employee_id]
    )

    res.json(result.rows[0])

})

/* CREATE / UPDATE PROFILE */

app.post("/update-profile", async (req, res) => {

    const { employee_id, name, email, phone, department } = req.body

    await pool.query(
        `INSERT INTO users_data(employee_id,name,email,phone,department)
VALUES($1,$2,$3,$4,$5)
ON CONFLICT(employee_id)
DO UPDATE SET
name=$2,
email=$3,
phone=$4,
department=$5`,
        [employee_id, name, email, phone, department]
    )

    res.json({
        success: true,
        message: "Profile saved successfully"
    })

})


/* UPDATE PASSWORD */

app.post("/update-password", async (req, res) => {

    const { employee_id, newpassword } = req.body

    const hash = await bcrypt.hash(newpassword, 10)

    await pool.query(
        "UPDATE users_login SET password=$1 WHERE employee_id=$2",
        [hash, employee_id]
    )

    res.json({
        success: true,
        message: "Password updated successfully"
    })

})


/* API TO GET USERS */

/* GET ONE USER BY EMPLOYEE ID */
/* LOGIN API: verify employee_id exists */
app.post("/api/login", async (req, res) => {
    try {
        const { employee_id } = req.body;

        const result = await pool.query(
            `SELECT employee_id, name, email, phone, department
       FROM users_data
       WHERE employee_id = $1`,
            [employee_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid employee id" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

/* GET ONE USER BY ID */
app.get("/api/user/:id", async (req, res) => {

    const empId = req.params.id;

    const result = await pool.query(
        "SELECT employee_id,name,email,phone,department FROM users_data WHERE employee_id=$1",
        [empId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);

});


/* INDEX PAGE BAR CHART AND INCIDENTS COUNT*/

app.get("/api/incident-types", async (req, res) => {

    const result = await pool.query(`
SELECT category AS incident_type,
COUNT(*) AS total
FROM incidents
GROUP BY category
`);

    res.json(result.rows);

});



app.get("/api/incident-districts", async (req, res) => {

    try {

        const result = await pool.query(`
SELECT district, COUNT(*) as total
FROM incidents
GROUP BY district
ORDER BY district
`);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }

});

app.get("/api/total-incidents", async (req, res) => {

    try {

        const result = await pool.query(`
SELECT COUNT(*) AS total
FROM incidents
`);

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }

});
const PORT = process.env.PORT || 5000;


/* SERVER START */

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});