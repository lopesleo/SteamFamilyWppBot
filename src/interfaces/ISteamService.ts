export interface SteamProfile {
  steamId: string; // ID do usuário Steam
  whatsappId?: string; // NOVO: Campo opcional para o ID do WhatsApp
  personaName: string; // Nome exibido
  realName?: string; // Nome real
  avatarSmall: string; // URL avatar 32x32
  avatarMedium: string; // URL avatar 64x64
  avatarFull: string; // URL avatar 184x184
  profileUrl: string;
  countryCode?: string;
  stateCode?: string;
  timeCreated?: number; // Unix timestamp
  lastLogOff?: number; // Unix timestamp
  personaState?: number;
}

export interface Game {
  appId: number;
  name: string;
  playtimeHours: number;
  imgIconUrl?: string;
  imgLogoUrl?: string;
}
// Interface para os links de vídeo (WebM e MP4)
interface VideoSources {
  "480": string;
  max: string;
}

// Interface para cada filme/trailer do jogo
interface Movie {
  id: number;
  name: string;
  thumbnail: string;
  webm: VideoSources;
  mp4: VideoSources;
  highlight: boolean;
}

// Interface para cada screenshot
interface Screenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

// Interface para as conquistas em destaque
interface HighlightedAchievement {
  name: string;
  path: string;
}

// Interface para os dados de conquistas
interface Achievements {
  total: number;
  highlighted: HighlightedAchievement[];
}

// Interface para os requisitos de sistema (PC, Mac, Linux)
interface SystemRequirements {
  minimum: string;
  recommended?: string;
}

// Interface para os gêneros e categorias
interface GenreOrCategory {
  id: string | number;
  description: string;
}

// Interface para a visão geral de preços
interface PriceOverview {
  currency: string;
  initial: number;
  final: number;
  discount_percent: number;
  initial_formatted: string;
  final_formatted: string;
}

// Interface para as assinaturas dentro de um grupo de pacotes
interface Subscription {
  packageid: number;
  percent_savings_text: string;
  percent_savings: number;
  option_text: string;
  option_description: string;
  can_get_free_license: string;
  is_free_license: boolean;
  price_in_cents_with_discount: number;
}

// Interface para os grupos de pacotes de compra
interface PackageGroup {
  name: string;
  title: string;
  description: string;
  selection_text: string;
  save_text: string;
  display_type: number;
  is_recurring_subscription: string;
  subs: Subscription[];
}

// Interface para a data de lançamento
interface ReleaseDate {
  coming_soon: boolean;
  date: string;
}

// Interface para informações de suporte
interface SupportInfo {
  url: string;
  email: string;
}

// Interface para as plataformas suportadas
interface Platforms {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}

// Interface para descritores de conteúdo
interface ContentDescriptors {
  ids: any[]; // O tipo pode ser mais específico se conhecido
  notes: string | null;
}

// Interfaces para os sistemas de classificação de idade
interface DejusRating {
  rating: string;
  descriptors: string;
  use_age_gate: string;
  required_age: string;
}

interface SteamGermanyRating {
  rating_generated: string;
  rating: string;
  required_age: string;
  banned: string;
  use_age_gate: string;
  descriptors: string;
}

interface Ratings {
  dejus: DejusRating;
  steam_germany: SteamGermanyRating;
}

// --- Interface Principal para os dados do jogo ---
export interface SteamGameDetails {
  type: string;
  name: string;
  steam_appid: number;
  required_age: number | string;
  is_free: boolean;
  controller_support?: string;
  dlc?: number[];
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  supported_languages: string;
  header_image: string;
  capsule_image: string;
  website: string | null;
  pc_requirements: { minimum?: string; recommended?: string };
  mac_requirements: { minimum?: string; recommended?: string };
  linux_requirements: { minimum?: string; recommended?: string };
  developers: string[];
  publishers: string[];
  price_overview?: any;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  metacritic?: { score: number; url: string };
  categories?: { id: number; description: string }[];
  genres?: { id: string; description: string }[];
  screenshots?: { id: number; path_thumbnail: string; path_full: string }[];
  release_date: { coming_soon: boolean; date: string };
}

export interface SteamApiResponse {
  [appId: string]: {
    success: boolean;
    data: SteamGameDetails;
  };
}
export interface StoreApiResponse {
  [appId: string]: {
    success: boolean;
    data?: SteamGameDetails;
  };
}
export interface Contribution {
  personaName: string; // Nome de quem contribuiu
  amount: number; // Valor contribuído
}

export interface Vaquinha {
  id: number;
  game_id: number;
  game_name: string;
  target_amount: number;
  amount_collected: number;
  status: "active" | "completed" | "cancelled";
  started_by: string; // personaName de quem iniciou
  contributions: Contribution[];
}

export interface ISteamService {
  getProfile(steamId: string): Promise<SteamProfile | null>;
  getOwnedGames(steamId: string): Promise<Game[]>;
  getRecentGames(steamId: string): Promise<Game[]>;
  resolveVanityURL(vanityUrl: string): Promise<string | null>;
  getGameInfo(appId: number): Promise<SteamGameDetails | null>;
}
