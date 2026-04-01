import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";
import type { GameContent } from "$lib/game/types";

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch("/game/data/assets.json");

  if (!response.ok) {
    throw error(response.status, `Unable to load game assets: ${response.status}`);
  }

  return {
    content: (await response.json()) as GameContent
  };
};
