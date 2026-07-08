const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres.tcpzenciiykmdhzrhamb:T7FDvcwBSTCUfxeq@aws-1-eu-north-1.pooler.supabase.com:5432/postgres";

async function run() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to Supabase PostgreSQL database...");
    await client.connect();
    console.log("Connected successfully. Running schema.sql...");
    
    // Run the entire SQL schema script
    await client.query(sql);
    console.log("Database schema initialized and seeded successfully!");
  } catch (err) {
    console.error("Error executing database schema setup:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
