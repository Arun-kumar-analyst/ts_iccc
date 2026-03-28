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
    user: "postgres",
    host: "localhost",
    database: "tgiccc_db",
    password: "admin123",
    port: 5432,
});

const checkAdmin = async (req, res, next) => {

try {

const employee_id = req.headers.employee_id;

if(!employee_id){
return res.status(401).json({message:"No user"});
}

const user = await pool.query(
"SELECT role FROM users_login WHERE employee_id=$1",
[employee_id]
);

if(user.rows.length === 0){
return res.status(401).json({message:"User not found"});
}

if(user.rows[0].role !== "admin"){
return res.status(403).json({message:"Admin only access"});
}

next();

} catch(err){
console.log(err);
res.status(500).json({message:"Server error"});
}

};

/* SAVE SHIFT */

app.post("/api/shift", async (req,res)=>{

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

try{

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

res.json({message:"Shift saved"});

}catch(err){
console.log(err);
res.status(500).json({message:"Server error"});
}

});


/* CURRENT SHIFT */

app.get("/api/shift/current", async (req, res) => {

    try{

        const result = await pool.query(`
            SELECT *
            FROM shift
            ORDER BY id DESC
            LIMIT 1
        `);

        if(result.rows.length === 0){
            return res.status(404).json({message:"No shift found"});
        }

        let data = result.rows[0];

        // ✅ Convert to array (important)
        if(typeof data.staff_names === "string"){
            data.staff_names = data.staff_names.split(",");
        }

        if(typeof data.place_name === "string"){
            data.place_name = data.place_name.split(",");
        }

        res.json(data);

    }catch(err){
        console.log(err);
        res.status(500).json({error:"Server error"});
    }
});

/* SHIFT HISTORY */

app.get("/api/shift/history", async (req, res) => {
    try{
        const result = await pool.query(`
            SELECT *
            FROM shift
            ORDER BY id DESC
        `);

        let data = result.rows.map(r => {

            // convert to array
            if(typeof r.staff_names === "string"){
                r.staff_names = r.staff_names.split(",");
            }

            if(typeof r.place_name === "string"){
                r.place_name = r.place_name.split(",");
            }

            return r;
        });

        res.json(data);

    }catch(err){
        console.log(err);
        res.status(500).json({error:"Server error"});
    }
});




// UPCOMING SHIFT API
app.get("/api/shift/upcoming", async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT *
            FROM shift
            WHERE start_time::time > CURRENT_TIME
            ORDER BY start_time::time ASC
            LIMIT 1
        `);

        if(result.rows.length === 0){
            return res.status(404).json({ message: "No upcoming shift" });
        }

        let data = result.rows[0];

        // Fix arrays (important)
        data.staff_names = Array.isArray(data.staff_names)
            ? data.staff_names
            : (data.staff_names ? data.staff_names.split(",") : []);

        data.place_name = Array.isArray(data.place_name)
            ? data.place_name
            : (data.place_name ? data.place_name.split(",") : []);

        res.json(data);

    } catch (err) {
        console.log("UPCOMING ERROR:", err);  // 👈 CHECK THIS
        res.status(500).json({ message: "Server error" });
    }
});

/* REGISTER */

app.post("/register", async (req,res)=>{

try{

const {employee_id,password,role} = req.body;

const check = await pool.query(
"SELECT * FROM users_login WHERE employee_id=$1",
[employee_id]
);

if(check.rows.length>0){
return res.json({
success:false,
message:"User already registered"
});
}

const hash = await bcrypt.hash(password,10);

// default role = user
const userRole = role || "user";

await pool.query(
"INSERT INTO users_login(employee_id,password,role) VALUES($1,$2,$3)",
[employee_id,hash,userRole]
);

res.json({
success:true,
message:"Registration successful"
});

}catch(err){
console.log(err);
res.json({success:false});
}

});

/* LOGIN */

app.post("/login", async (req,res)=>{

try{

const {employee_id,password} = req.body;

const user = await pool.query(
"SELECT * FROM users_login WHERE employee_id=$1",
[employee_id]
);

if(user.rows.length===0){
return res.json({
success:false,
message:"User not found"
});
}

const valid = await bcrypt.compare(
password,
user.rows[0].password
);

if(!valid){
return res.json({
success:false,
message:"Invalid password"
});
}

res.json({
success:true,
message:"Login successful",
employee_id: user.rows[0].employee_id,
role: user.rows[0].role   // 👈 IMPORTANT
});

}catch(err){
console.log(err);
res.json({success:false});
}

});


/* FORGOT PASSWORD */

app.post("/forgot-password", async (req,res)=>{

try{

const {employee_id,newpassword} = req.body;

const user = await pool.query(
"SELECT * FROM users_login WHERE employee_id=$1",
[employee_id]
);

if(user.rows.length===0){

return res.json({
success:false,
message:"User not found"
});

}

const hash = await bcrypt.hash(newpassword,10);

await pool.query(
"UPDATE users_login SET password=$1 WHERE employee_id=$2",
[hash,employee_id]
);

res.json({
success:true,
message:"Password updated successfully"
});

}
catch(err){

console.log(err);

res.json({
success:false
});

}

});


/* NOTICES */

/* GET notices */

app.get("/api/notices", async (req,res)=>{

const result = await pool.query(
"SELECT * FROM notices ORDER BY created_dt DESC"
);

res.json(result.rows);

});

/* CREATE notice */

app.post("/api/notices", async (req,res)=>{

try{

const {title,content,priority} = req.body;

const result = await pool.query(

`INSERT INTO notices(title,content,priority)
 VALUES($1,$2,$3)
 RETURNING *`,

[title,content,priority]

);

res.json(result.rows[0]);

}catch(err){
console.log(err);
res.status(500).json({message:"Server error"});
}

});


/* UPDATE notice */

// UPDATE notice → ADMIN ONLY
app.put("/api/notices/:id", checkAdmin, async (req,res)=>{

const id = req.params.id;
const {title,content,priority} = req.body;

await pool.query(
`UPDATE notices
 SET title=$1,
     content=$2,
     priority=$3,
     updated_dt=CURRENT_TIMESTAMP
 WHERE id=$4`,
[title,content,priority,id]
);

res.json({status:"updated"});
});


/* DELETE notice */

// DELETE notice → ADMIN ONLY
app.delete("/api/notices/:id", checkAdmin, async (req,res)=>{

const id=req.params.id;

await pool.query(
"DELETE FROM notices WHERE id=$1",
[id]
);

res.json({status:"deleted"});
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

/* FIX TIMESTAMP ERROR */

if(!reported_time || reported_time.trim()===""){
reported_time = null;
}

let file_path = null;

if (req.file) {
file_path = "uploads/" + req.file.filename;
}

await pool.query(

`INSERT INTO incidents
(
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
VALUES
($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'OPEN')`,

[
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
]

);

res.json({ success:true, message:"Incident saved" });

} catch (err) {

console.log(err);
res.status(500).json({ error:"Server error" });

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

app.post("/updateStatus", checkAdmin, async (req,res)=>{

try{

const {incident_id,status} = req.body;

await pool.query(
"UPDATE incidents SET status=$1 WHERE incident_id=$2",
[status,incident_id]
);

res.json({success:true});

}catch(err){
console.log(err);
res.json({success:false});
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



/* UPDATE EVENT PUT */

app.put("/api/events/:id", checkAdmin, async (req, res) => {

const { id } = req.params;
const { title, description, date, time, location } = req.body;

await pool.query(
"UPDATE events SET title=$1, description=$2, event_date=$3, event_time=$4, location=$5 WHERE id=$6",
[title, description, date, time, location, id]
);

res.json({ success: true });
});


/* DELETE */
app.delete("/api/events/:id", checkAdmin, async (req, res) => {

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
        const result = await pool.query(`
            SELECT id,
                   title,
                   description,
                   file_name,
                   file_size,
                   created_at
            FROM documents
            ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/download/:filename", checkAdmin, (req, res) => {
    const filePath = path.join(__dirname, "uploads", req.params.filename);
    res.download(filePath);
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
app.put("/tasks/:id/status", checkAdmin, async (req,res)=>{

try{

const {status} = req.body;

await pool.query(
"UPDATE tasks SET status=$1 WHERE id=$2",
[status, req.params.id]
);

res.json({success:true});

}catch(err){
console.log(err);
res.status(500).json({message:"Server error"});
}

});



/* =========================
   DELETE TASK
========================= */

app.delete("/tasks/:id", checkAdmin, async (req, res) => {

await pool.query("DELETE FROM tasks WHERE id=$1", [req.params.id]);

res.json({ message: "Deleted" });

});



/* GET ALL DIRECTORIES */

/* GET DATA */

app.get("/directories", async (req,res)=>{

try{

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

}catch(err){

console.log(err)
res.status(500).send("Database error")

}

})

/* INSERT DATA */

app.post("/createDirectory", async (req,res)=>{

try{

const {branch,personnel,pcs,rank,alias,phone,email} = req.body

await pool.query(

`INSERT INTO directory_personnel
(branch_name,personnel_number,pcs,rank,alias_name,phone_number,email)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,

[branch,personnel,pcs,rank,alias,phone,email]

)

res.json({message:"Directory saved"})

}catch(err){

console.log(err)
res.status(500).send("Insert error")

}

})

/* DIRECTORY BRANCH COUNT */

app.get("/branchCounts", async (req,res)=>{

const result = await db.query(`
SELECT branch, COUNT(personnel) AS total_personnel
FROM directories
GROUP BY branch
`)

res.json(result.rows)

})






/* UPDATE PASSOWRD PROFILE */

/* GET PROFILE */

app.get("/profile/:employee_id", async (req,res)=>{

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

app.post("/update-profile",async(req,res)=>{

const {employee_id,name,email,phone,department}=req.body

await pool.query(
`INSERT INTO users_data(employee_id,name,email,phone,department)
VALUES($1,$2,$3,$4,$5)
ON CONFLICT(employee_id)
DO UPDATE SET
name=$2,
email=$3,
phone=$4,
department=$5`,
[employee_id,name,email,phone,department]
)

res.json({
success:true,
message:"Profile saved successfully"
})

})


/* UPDATE PASSWORD */

app.post("/update-password",async(req,res)=>{

const {employee_id,newpassword}=req.body

const hash=await bcrypt.hash(newpassword,10)

await pool.query(
"UPDATE users_login SET password=$1 WHERE employee_id=$2",
[hash,employee_id]
)

res.json({
success:true,
message:"Password updated successfully"
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
app.get("/api/user/:id", async (req,res)=>{

const empId = req.params.id;

const result = await pool.query(
"SELECT employee_id,name,email,phone,department FROM users_data WHERE employee_id=$1",
[empId]
);

if(result.rows.length===0){
return res.status(404).json({message:"User not found"});
}

res.json(result.rows[0]);

});


/* INDEX PAGE BAR CHART AND INCIDENTS COUNT*/

app.get("/api/incident-types", async (req,res)=>{

const result = await pool.query(`
SELECT category AS incident_type,
COUNT(*) AS total
FROM incidents
GROUP BY category
`);

res.json(result.rows);

});



app.get("/api/incident-districts", async (req,res)=>{

try{

const result = await pool.query(`
SELECT district, COUNT(*) as total
FROM incidents
GROUP BY district
ORDER BY district
`);

res.json(result.rows);

}catch(err){
console.error(err);
res.status(500).send("Server error");
}

});

app.get("/api/total-incidents", async (req,res)=>{

try{

const result = await pool.query(`
SELECT COUNT(*) AS total
FROM incidents
`);

res.json(result.rows[0]);

}catch(err){
console.error(err);
res.status(500).send("Server error");
}

});



/* SERVER START */

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});