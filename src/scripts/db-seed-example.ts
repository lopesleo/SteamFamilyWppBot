import { DatabaseService } from "../services/DatabaseService";
import "dotenv/config";

interface FamilyMember {
  nickname: string;
  steamId: string;
  whatsappId: string; // Formato: 55[DDD][Numero]@s.whatsapp.net
}

export const familyMemberData: FamilyMember[] = [
  {
    nickname: "example1",
    steamId: "12345678901234567",
    whatsappId: "550000000001@s.whatsapp.net",
  },
  {
    nickname: "example2",
    steamId: "23456789012345678",
    whatsappId: "550000000002@s.whatsapp.net",
  },
  {
    nickname: "example3",
    steamId: "34567890123456789",
    whatsappId: "550000000003@s.whatsapp.net",
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
}

seed();
