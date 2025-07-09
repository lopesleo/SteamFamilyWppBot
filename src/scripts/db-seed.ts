import { DatabaseService } from "../services/DatabaseService";
import "dotenv/config";

// Interface para clareza dos dados dos membros
interface FamilyMember {
  nickname: string;
  steamId: string;
  whatsappId: string; // Formato: 55[DDD][Numero]@c.us
}

export const familyMemberData: FamilyMember[] = [
  {
    nickname: "skeik",
    steamId: "76561198065315505",
    whatsappId: "5522988125453@s.whatsapp.net",
  },
  {
    nickname: "xkomedy",
    steamId: "76561198074205211",
    whatsappId: "5522998237519@s.whatsapp.net",
  },
  {
    nickname: "beibe",
    steamId: "76561198214376004",
    whatsappId: "5522998182369@s.whatsapp.net",
  },
  {
    nickname: "méfiu",
    steamId: "76561198086970351",
    whatsappId: "5522997012046@s.whatsapp.net",
  },
  {
    nickname: "Vitoroffs",
    steamId: "76561198147124732",
    whatsappId: "5522999800898@s.whatsapp.net",
  },
  {
    nickname: "phelipe",
    steamId: "76561198066936599",
    whatsappId: "5522997745789@s.whatsapp.net",
  },
];

async function seed() {
  console.log("🌱 Executando script para popular o banco de dados...");
  const dbService = new DatabaseService();

  for (const member of familyMemberData) {
    console.log(`Inserindo/Atualizando membro: ${member.nickname}`);
    await dbService.upsertUser({
      steamId: member.steamId,
      whatsappId: member.whatsappId,
      personaName: member.nickname,
      profileUrl: `https://steamcommunity.com/profiles/${member.steamId}`,
      avatarSmall: "",
      avatarMedium: "",
      avatarFull: "",
    });
  }

  console.log("✅ Processo de seed concluído.");
  // Em alguns ambientes, o pool de conexão do PG pode manter o processo vivo.
  // Forçamos o encerramento para garantir que o script termine.
}

seed();
