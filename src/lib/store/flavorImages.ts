/* The pictures of a product's flavours, for its banner on the store's stage.
 *
 * Keyed by slug, main flavour first — that one stands in the middle and the
 * rest are set out on either side of it. A product with no entry here (one
 * flavour, or added later from the panel) shows its own single picture. */

const BASE = "/images/store/product-png";

export const FLAVOR_IMAGES: Record<string, string[]> = {
  "ans-n-whey": [
    `${BASE}/ans-n-whey-banana-cream.png`,
    `${BASE}/ans-n-whey-milk-chocolate.png`,
    `${BASE}/ans-n-whey-creamy-vanilla.png`,
    `${BASE}/ans-n-whey-strawberry-milkshake.png`,
  ],
  "protein-pancake-waffle": [
    `${BASE}/rvit-protein-pancake-waffle-3000g-chocolate.png`,
    `${BASE}/rvit-protein-pancake-waffle-3000g-vanilla.png`,
    `${BASE}/rvit-protein-pancake-waffle-3000g-raspberry.png`,
    `${BASE}/rvit-protein-pancake-waffle-1200g-gingerbread.png`,
  ],
  "rvit-creatine": [
    `${BASE}/rvit-creatine-monohydrate-blackcurrant.png`,
    `${BASE}/rvit-creatine-monohydrate-orange.png`,
    `${BASE}/rvit-creatine-monohydrate-lemon.png`,
    `${BASE}/rvit-creatine-monohydrate-bubble-gum.png`,
    `${BASE}/rvit-creatine-monohydrate-ice-candy.png`,
    `${BASE}/rvit-creatine-monohydrate-neutral.png`,
  ],
  "lusty-preworkout": [
    `${BASE}/rvit-lusty-preworkout-blackcurrant.png`,
    `${BASE}/rvit-lusty-preworkout-lemon.png`,
    `${BASE}/rvit-lusty-preworkout-multifruit.png`,
    `${BASE}/rvit-lusty-preworkout-strawberry-passion-fruit.png`,
  ],
  "vast-mass": [
    `${BASE}/rvit-vast-mass-strawberry.png`,
    `${BASE}/rvit-vast-mass-chocolate.png`,
    `${BASE}/rvit-vast-mass-banana.png`,
    `${BASE}/rvit-vast-mass-cookies.png`,
    `${BASE}/rvit-vast-mass-salted-caramel.png`,
    `${BASE}/rvit-vast-mass-peach.png`,
    `${BASE}/rvit-vast-mass-orange-cheesecake.png`,
  ],
  "rice-carbs-pure": [
    `${BASE}/rvit-rice-carbs-pure-banana.png`,
    `${BASE}/rvit-rice-carbs-pure-milk-chocolate.png`,
    `${BASE}/rvit-rice-carbs-pure-strawberry.png`,
    `${BASE}/rvit-rice-carbs-pure-vanilla.png`,
    `${BASE}/rvit-rice-carbs-pure-apple-cinnamon.png`,
  ],
  "beta-alanine": [
    `${BASE}/rvit-beta-alanine-cola.png`,
    `${BASE}/rvit-beta-alanine-strawberry.png`,
    `${BASE}/rvit-beta-alanine-neutral.png`,
  ],
};
