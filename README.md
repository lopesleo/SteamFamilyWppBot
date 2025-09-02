# SteamFamilyZap

Assistente do WhatsApp (Baileys) para gerenciar a família Steam: consulta perfis, jogos, atividade recente, detalhes da loja, lista de jogos com Family Sharing, relatório de cópias e gerenciamento de “vaquinha” para compra de jogos. Usa IA (Gemini) para entender comandos e Postgres para persistência.

- Ponto de entrada: [src/app.ts](src/app.ts)
- Cliente WhatsApp: [src/services/WhatsappBaileysClient.ts](src/services/WhatsappBaileysClient.ts)
- Steam API: [src/services/SteamService.ts](src/services/SteamService.ts) (ex.: [`SteamService.getGameInfo`](src/services/SteamService.ts))
- Banco de dados: [src/services/DatabaseService.ts](src/services/DatabaseService.ts) (ex.: `upsertUser`, `getOwnedGames`, `createVaquinha`)
- IA (Gemini): [src/services/GeminiAIService.ts](src/services/GeminiAIService.ts)
- Funções (ferramentas) chamadas pela IA: [src/tools.ts](src/tools.ts)
- Prompt do assistente: [src/prompts.ts](src/prompts.ts)
- Scripts de banco: [src/scripts](src/scripts)

## Requisitos

- Node.js 18+ (recomendado 20+)
- pnpm (recomendado) ou npm/yarn
- Banco PostgreSQL (ex.: Neon) com string `DATABASE_URL`
- Chaves:
  - STEAM_APIKEY (Steam Web API)
  - GEMINI_APIKEY (Google Gemini)
  - BOT_PHONE_NUMBER (número do bot, com DDI/DDD)
  - WHATSAPP_GROUP_ID (JID do grupo WhatsApp destino)

## Configuração

1. Instale dependências

```bash
pnpm install
# ou
npm install
```

2. Configure variáveis de ambiente  
   Copie `.env.example` para `.env` e preencha:

```bash
# .env
STEAM_APIKEY=coloque_sua_chave_steam
GEMINI_APIKEY=coloque_sua_chave_gemini
DATABASE_URL=postgres://user:pass@host:5432/dbname
BOT_PHONE_NUMBER=55XXXXXXXXXXX
WHATSAPP_GROUP_ID=XXXXXXXXXXXXX-XXXXXXXXXX@g.us
```

3. Aplique o schema no banco

```bash
# via ts-node
pnpm ts-node --project tsconfig.json src/scripts/db-apply-schema.ts
# ou
npx ts-node --project tsconfig.json src/scripts/db-apply-schema.ts
```

Arquivo: [src/scripts/db-apply-schema.ts](src/scripts/db-apply-schema.ts) que lê [src/database/schema.sql](src/database/schema.sql).

4. Cadastre membros da família (seed)

- Edite os membros em [src/scripts/db-seed.ts](src/scripts/db-seed.ts) (lista `familyMemberData`).
- Execute:

```bash
pnpm ts-node --project tsconfig.json src/scripts/db-seed.ts
```

5. Opcional: sincronize jogos dos membros e detalhes

- Sincroniza jogos de cada membro e grava os detalhes dos jogos únicos:

```bash
pnpm ts-node --project tsconfig.json src/scripts/db-setFamilyGames.ts
```

- Sincronização pesada do catálogo geral (opcional e demorado):

```bash
pnpm ts-node --project tsconfig.json src/scripts/db-syncAllGamesFromSteam.ts
```

## Executando o bot

Ambiente de desenvolvimento:

```bash
pnpm dev
# ou
npm run dev
```

Primeiro login no WhatsApp:

- Um QR Code será exibido no terminal (via Baileys). Escaneie com o app do WhatsApp do número do bot.
- A sessão é salva na pasta `auth_info_baileys/`.

Execução com PM2 (produção):

```bash
# iniciar app
pm2 start ecosystem.config.js --only steamfamilyzap-app
pm2 logs steamfamilyzap-app

# scripts avulsos (exemplos)
pm2 start ecosystem.config.js --only db-apply-schema
pm2 start ecosystem.config.js --only db-seed
pm2 start ecosystem.config.js --only db-setFamilyGames
pm2 start ecosystem.config.js --only db-syncAllGames
```

Arquivo: [ecosystem.config.js](ecosystem.config.js)

## Como usar (no WhatsApp)

- Em grupo: mencione o bot para que a mensagem seja processada (o cliente verifica menções no grupo).
- Em privado: envie a mensagem normalmente.

Exemplos de comandos/frases que a IA entende (português livre):

- Perfil: “perfil do skeik”, “meu perfil”
- Biblioteca: “jogos do phelipe”
- Recentes: “recentes do méfiu”
- Detalhes do jogo: “detalhes do jogo Hades”
- Family Sharing: “listar jogos com family sharing”
- Relatório de cópias: “relatório de cópias da família”
- Vaquinha:
  - “criar vakinha Hades”
  - “contribuir 10,50”
  - “status vakinha”
  - “cancelar vakinha”
  - “fechar vakinha”

Fluxo interno:

- A IA decide qual ferramenta chamar a partir de [src/tools.ts](src/tools.ts).
- O roteamento e execução das ferramentas são feitos em [src/app.ts](src/app.ts) (switch no `handleMessage`).
- Envio de mensagens/imagens/menções: [`WhatsAppBaileysClient.sendMessage`](src/services/WhatsappBaileysClient.ts) e marcação de usuários via [`Bot.processMentions`](src/app.ts).

## Recursos automáticos

- Checagem e anúncio de jogos grátis (GamerPower) a cada 6h:
  - Agendamento: `scheduleFreeGamesCheck()` em [src/app.ts](src/app.ts)
  - Execução: `checkForNewGiveaways()` em [src/app.ts](src/app.ts)
  - Serviço: [src/services/GamePowerService.ts](src/services/GamePowerService.ts)

## Dicas e solução de problemas

- Falta de variável no .env:
  - “Chaves de API da Steam ou Gemini não definidas”: verifique STEAM_APIKEY/GEMINI_APIKEY.
  - “Número do bot não definido”: configure BOT_PHONE_NUMBER.
  - “ID do grupo do WhatsApp não definido”: configure WHATSAPP_GROUP_ID.
  - “DATABASE_URL não encontrada”: configure a URL do Postgres.

- QR Code não aparece ou sessão corrompida:
  - Apague a pasta `auth_info_baileys/` e reinicie o processo.

- API Steam limitações:
  - Sincronizações longas usam atrasos para respeitar rate limits (ver [src/scripts/db-setFamilyGames.ts](src/scripts/db-setFamilyGames.ts)).
  - Detalhes de jogos: [`SteamService.getGameInfo`](src/services/SteamService.ts) upserta jogo básico e salva detalhes.

## Estrutura principal

- App/bot: [src/app.ts](src/app.ts)
- WhatsApp: [src/services/WhatsappBaileysClient.ts](src/services/WhatsappBaileysClient.ts)
- Steam: [src/services/SteamService.ts](src/services/SteamService.ts)
- Banco: [src/services/DatabaseService.ts](src/services/DatabaseService.ts)
- IA (Gemini): [src/services/GeminiAIService.ts](src/services/GeminiAIService.ts)
- Tools: [src/tools.ts](src/tools.ts)
- Prompts: [src/prompts.ts](src/prompts.ts)
- Scripts DB: [src/scripts](src/scripts)
