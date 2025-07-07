-- Remove tabelas existentes para garantir uma criação limpa
-- A ordem é importante por causa das chaves estrangeiras
DROP TABLE IF EXISTS user_games;
DROP TABLE IF EXISTS game_details;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS users;

-- Cria a tabela de usuários
CREATE TABLE users (
  steam_id TEXT PRIMARY KEY,
  whatsapp_id TEXT UNIQUE,
  persona_name TEXT NOT NULL,
  real_name TEXT,
  avatar_small TEXT,
  avatar_medium TEXT,
  avatar_full TEXT,
  profile_url TEXT,
  last_log_off BIGINT,
  persona_state INTEGER,
  updated_at BIGINT NOT NULL
);

-- Cria a tabela de catálogo de jogos (simples)
CREATE TABLE games (
  app_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  img_logo_url TEXT,
  updated_at BIGINT NOT NULL
);

-- Tabela para armazenar os detalhes completos dos jogos em formato JSON
CREATE TABLE game_details (
  app_id INTEGER PRIMARY KEY,
  details JSONB NOT NULL, -- Armazena todo o JSON de detalhes aqui
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (app_id) REFERENCES games (app_id) ON DELETE CASCADE
);

-- Cria a tabela de junção para jogos por usuário
CREATE TABLE user_games (
  user_id TEXT,
  game_id INTEGER,
  playtime_hours INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users (steam_id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games (app_id) ON DELETE CASCADE
);

CREATE TABLE vaquinhas (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL,
  target_amount NUMERIC(10, 2) NOT NULL,
  amount_collected NUMERIC(10, 2) DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  started_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (game_id) REFERENCES games (app_id),
  FOREIGN KEY (started_by_user_id) REFERENCES users (steam_id)
);

CREATE TABLE contributions (
    id SERIAL PRIMARY KEY,
    vaquinha_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (vaquinha_id) REFERENCES vaquinhas (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (steam_id)
);