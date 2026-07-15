/**
 * Food catalogue. Colors are placeholders for the clean-modern art pass; each
 * type has a `quality` (how much it grows the monster / scores) and a stable
 * id used later by the craving system.
 */
export interface FoodType {
  id: string;
  color: number;
  quality: number;
}

export const FOOD_TYPES: FoodType[] = [
  { id: "berry", color: 0xf27a9b, quality: 1 },
  { id: "apple", color: 0xe2504a, quality: 2 },
  { id: "lime", color: 0x8ad155, quality: 2 },
  { id: "honey", color: 0xf7b955, quality: 3 },
  { id: "plum", color: 0x9b7bd4, quality: 3 },
  { id: "blueberry", color: 0x5b9be2, quality: 4 },
];

export const MEGA: FoodType = { id: "mega", color: 0xffd66b, quality: 12 };

export const FOOD_RADIUS = 17;
export const MEGA_RADIUS = 26;
