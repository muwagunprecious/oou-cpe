const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres.tcpzenciiykmdhzrhamb:T7FDvcwBSTCUfxeq@aws-1-eu-north-1.pooler.supabase.com:5432/postgres";

async function run() {
  const sqlPath = path.join(__dirname, 'migration_v3.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to Supabase PostgreSQL...");
    await client.connect();
    console.log("Connected. Running migration_v3.sql...");
    await client.query(sql);
    console.log("Migration v3 applied successfully!");
  } catch (err) {
    console.error("Error executing migration:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
