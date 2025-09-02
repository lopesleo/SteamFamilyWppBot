import {
  FunctionDeclarationsTool,
  SchemaType,
} from "@google/generative-ai/server";

export const tools: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: "get_steam_profile",
        description:
          "Obtém informações do perfil de um jogador da Steam com base em seu apelido, SteamID ou a palavra 'me'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            identifier: {
              type: SchemaType.STRING,
              description:
                "O apelido (ex: 'skeik'), o SteamID64 do jogador, ou 'me' para o próprio usuário.",
            },
          },
          required: ["identifier"],
        },
      },
      {
        name: "get_owned_games",
        description:
          "Obtém a lista de jogos possuídos por um jogador da Steam com base em seu apelido, SteamID ou 'me'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            identifier: {
              type: SchemaType.STRING,
              description:
                "O apelido (ex: 'skeik'), o SteamID64 do jogador, ou 'me' para o próprio usuário.",
            },
          },
          required: ["identifier"],
        },
      },
      {
        name: "get_recent_games",
        description:
          "Obtém a lista de jogos recentes jogados por um jogador da Steam com base em seu apelido, SteamID ou 'me'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            identifier: {
              type: SchemaType.STRING,
              description:
                "O apelido (ex: 'skeik'), o SteamID64 do jogador, ou 'me' para o próprio usuário.",
            },
          },
          required: ["identifier"],
        },
      },
      {
        name: "get_game_details",
        description:
          "Obtém informações detalhadas sobre um jogo específico, como descrição, gênero e desenvolvedor, com base no nome do jogo.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            game_name: {
              type: SchemaType.STRING,
              description: "O nome do jogo a ser pesquisado. Ex: 'Half-Life 2'",
            },
          },
          required: ["game_name"],
        },
      },
      {
        name: "get_family_sharing_games",
        description:
          "Exibe uma lista completa e única de todos os jogos que a família possui. Use esta função para ver a biblioteca inteira de jogos da família.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}, // Esta função não precisa de parâmetros
        },
      },
      {
        name: "get_game_copies_report",
        description:
          "Cria um relatório que conta quantas cópias de cada jogo existem na família. O resultado é ordenado para mostrar os jogos mais populares (com mais cópias) primeiro.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}, // Esta função não precisa de parâmetros
        },
      },
      {
        name: "start_vaquinha",
        description:
          "Inicia uma nova vaquinha para comprar um jogo para a família.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            game_name: {
              type: SchemaType.STRING,
              description:
                "O nome exato do jogo para o qual a vaquinha será criada.",
            },
          },
          required: ["game_name"],
        },
      },
      {
        name: "contribute_to_vaquinha",
        description:
          "Adiciona uma contribuição em dinheiro a UNICA vaquinha ativa.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            amount: {
              type: SchemaType.NUMBER,
              description: "O valor em dinheiro a ser contribuído. Ex: 10.50",
            },
          },
          required: ["amount"],
        },
      },
      {
        name: "get_vaquinha_status",
        description:
          "Verifica o status da vaquinha atualmente ativa, mostrando o total arrecadado e quem já contribuiu.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "cancel_vaquinha",
        description: "Cancela a vaquinha de jogo que está ativa no momento.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
    ],
  },
];
