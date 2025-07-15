export interface Giveaway {
  id: number;
  title: string;
  worth: string;
  thumbnail: string;
  image: string;
  description: string;
  instructions: string;
  open_giveaway_url: string;
  published_date: string;
  type: "Game" | "Loot" | "Beta";
  platforms: string;
  end_date: string;
  users: number;
  status: "active" | "expired";
  gamerpower_url: string;
  open_giveaway: string;
}

export interface IGamerPowerService {
  getGiveaways(filters?: {
    platform?: string;
    type?: string;
    "sort-by"?: string;
  }): Promise<Giveaway[]>;
}
