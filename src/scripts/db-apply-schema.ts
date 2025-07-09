// src/scripts/db-apply-schema.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";

async function applySchema() {
  console.log("Aplicando schema ao banco de dados Neon...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não encontrada no .env");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, "../database/schema.sql"), // Caminho para seu arquivo .sql
      "utf8"
    );

    await client.connect();
    await client.query(schemaSql);
    console.log("✅ Schema aplicado com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao aplicar o schema:", err);
  } finally {
    await client.end();
    console.log("Conexão com o banco de dados fechada.");
  }
}

applySchema();
