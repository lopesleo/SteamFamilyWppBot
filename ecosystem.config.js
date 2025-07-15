// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "steamfamilyzap-app", // Um nome amigável para sua aplicação no PM2
      script: "npm run dev", // <-- APONTE DIRETAMENTE PARA O SEU ARQUIVO TS DE ENTRADA

      ignore_watch: [
        "node_modules", // Ignora a pasta de dependências
        "logs", // Ignora a pasta de logs
        "dist", // CRUCIAL: Ignora a pasta de saída da compilação TypeScript
        "package-lock.json", // Ignora alterações no lock file do npm
        ".env", // Opcional: Se seu .env for alterado com frequência, ignore-o
      ],

      // Configurações de log
      log_file: "logs/pm2.log", // Arquivo de log geral do PM2 para esta aplicação
      out_file: "logs/app-out.log", // Log da saída padrão (console.log)
      error_file: "logs/app-error.log", // Log da saída de erro (console.error)
    },
    {
      name: "db-seed",
      script: "./node_modules/.bin/ts-node",
      args: "--project tsconfig.json ./src/scripts/db-seed.ts",
      autorestart: false,
      watch: false,
    },
    {
      name: "db-setFamilyGames",
      script: "./node_modules/.bin/ts-node",
      args: "--project tsconfig.json ./src/scripts/db-setFamilyGames.ts",
      autorestart: false,
      watch: false,
    },
    {
      name: "db-syncAllGames",
      script: "./node_modules/.bin/ts-node",
      args: "--project tsconfig.json ./src/scripts/db-syncAllGamesFromSteam.ts",
      autorestart: false,
      watch: false,
    },
    {
      name: "db-apply-schema",
      script: "./node_modules/.bin/ts-node",
      args: "--project tsconfig.json ./src/scripts/db-apply-schema.ts",
      autorestart: false,
      watch: false,
    },
  ],
};
