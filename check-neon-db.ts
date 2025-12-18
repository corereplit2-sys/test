// Check Neon database schema using project setup
import { pool } from "./server/db.ts";

async function checkTables() {
  try {
    console.log("=== Checking IPPT Tables in Neon Database ===");

    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ippt_attempts', 'ippt_sessions')
      ORDER BY table_name
    `;

    const tablesResult = await pool.query(tablesQuery);
    console.log(
      "Found tables:",
      tablesResult.rows.map((r) => r.table_name)
    );

    // Check ippt_attempts schema
    if (tablesResult.rows.some((r) => r.table_name === "ippt_attempts")) {
      console.log("\n=== IPPT_ATTEMPTS Schema ===");
      const attemptsSchema = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'ippt_attempts' 
        ORDER BY ordinal_position
      `);

      attemptsSchema.rows.forEach((col) => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });

      // Check sample data
      const attemptsCount = await pool.query("SELECT COUNT(*) as count FROM ippt_attempts");
      console.log(`\nIPPT Attempts count: ${attemptsCount.rows[0].count}`);

      if (parseInt(attemptsCount.rows[0].count) > 0) {
        const sample = await pool.query("SELECT * FROM ippt_attempts LIMIT 2");
        console.log("Sample data:");
        console.log(sample.rows);
      }
    }

    // Check ippt_sessions schema
    if (tablesResult.rows.some((r) => r.table_name === "ippt_sessions")) {
      console.log("\n=== IPPT_SESSIONS Schema ===");
      const sessionsSchema = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'ippt_sessions' 
        ORDER BY ordinal_position
      `);

      sessionsSchema.rows.forEach((col) => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });

      // Check sample data
      const sessionsCount = await pool.query("SELECT COUNT(*) as count FROM ippt_sessions");
      console.log(`\nIPPT Sessions count: ${sessionsCount.rows[0].count}`);

      if (parseInt(sessionsCount.rows[0].count) > 0) {
        const sample = await pool.query("SELECT * FROM ippt_sessions LIMIT 2");
        console.log("Sample data:");
        console.log(sample.rows);
      }
    }
  } catch (error) {
    console.error("Database error:", error);
  } finally {
    await pool.end();
  }
}

checkTables();
