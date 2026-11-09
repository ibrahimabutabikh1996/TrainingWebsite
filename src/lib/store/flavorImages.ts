/* The pictures of a product's flavours, for its banner on the store's stage.
 *
 * Keyed by slug, main flavour first — that one is lit until a visitor picks
 * another. A product with no entry here (one flavour, or added later from the
 * panel) shows its own single picture. */

export interface FlavorImage {
  src: string;
  /** The flavour's name, shown under the tubs while it is the chosen one. */
  label: string;
  /** Scales a picture whose tub fills more of its frame, so the row matches. */
  fit?: number;
}

const BASE = "/images/store";

export const FLAVOR_IMAGES: Record<string, FlavorImage[]> = {
  "ans-n-whey": [
    { src: `${BASE}/ans-n-whey-banana-cream.png`, label: "كريمة الموز" },
    { src: `${BASE}/ans-n-whey-milk-chocolate.png`, label: "شوكولاتة بالحليب" },
    { src: `${BASE}/ans-n-whey-creamy-vanilla.png`, label: "فانيليا كريمية" },
    { src: `${BASE}/ans-n-whey-strawberry-milkshake.png`, label: "ميلك شيك الفراولة" },
  ],
  "protein-pancake-waffle": [
    { src: `${BASE}/protein-pancake.webp`, label: "شوكولاتة" },
    { src: `${BASE}/rvit-protein-pancake-waffle-3000g-vanilla.png`, label: "فانيليا" },
    { src: `${BASE}/rvit-protein-pancake-waffle-3000g-raspberry.png`, label: "توت العليق" },
    { src: `${BASE}/rvit-protein-pancake-waffle-1200g-gingerbread.png`, label: "خبز الزنجبيل", fit: 0.88 },
  ],
  "rvit-creatine": [
    { src: `${BASE}/rvit-creatine-monohydrate-blackcurrant.png`, label: "كشمش أسود" },
    { src: `${BASE}/rvit-creatine-monohydrate-orange.png`, label: "برتقال" },
    { src: `${BASE}/rvit-creatine-monohydrate-lemon.png`, label: "ليمون" },
    { src: `${BASE}/rvit-creatine-monohydrate-bubble-gum.png`, label: "علكة" },
    { src: `${BASE}/rvit-creatine-monohydrate-ice-candy.png`, label: "حلوى مثلجة" },
    { src: `${BASE}/rvit-creatine-monohydrate-neutral.png`, label: "بدون نكهة" },
  ],
  "lusty-preworkout": [
    { src: `${BASE}/rvit-lusty-preworkout-blackcurrant.png`, label: "كشمش أسود" },
    { src: `${BASE}/rvit-lusty-preworkout-lemon.png`, label: "ليمون" },
    { src: `${BASE}/rvit-lusty-preworkout-multifruit.png`, label: "فواكه مشكلة" },
    { src: `${BASE}/rvit-lusty-preworkout-strawberry-passion-fruit.png`, label: "فراولة وباشن فروت" },
  ],
  "vast-mass": [
    { src: `${BASE}/rvit-vast-mass-strawberry.png`, label: "فراولة" },
    { src: `${BASE}/rvit-vast-mass-chocolate.png`, label: "شوكولاتة" },
    { src: `${BASE}/rvit-vast-mass-banana.png`, label: "موز" },
    { src: `${BASE}/rvit-vast-mass-cookies.png`, label: "كوكيز" },
    { src: `${BASE}/rvit-vast-mass-salted-caramel.png`, label: "كراميل مملح" },
    { src: `${BASE}/rvit-vast-mass-peach.png`, label: "خوخ" },
    { src: `${BASE}/rvit-vast-mass-orange-cheesecake.png`, label: "تشيز كيك بالبرتقال" },
  ],
  "rice-carbs-pure": [
    { src: `${BASE}/rvit-rice-carbs-pure-banana.png`, label: "موز" },
    { src: `${BASE}/rvit-rice-carbs-pure-milk-chocolate.png`, label: "شوكولاتة بالحليب" },
    { src: `${BASE}/rvit-rice-carbs-pure-strawberry.png`, label: "فراولة" },
    { src: `${BASE}/rvit-rice-carbs-pure-vanilla.png`, label: "فانيليا" },
    { src: `${BASE}/rvit-rice-carbs-pure-apple-cinnamon.png`, label: "تفاح وقرفة" },
  ],
  "beta-alanine": [
    { src: `${BASE}/rvit-beta-alanine-cola.png`, label: "كولا" },
    { src: `${BASE}/rvit-beta-alanine-strawberry.png`, label: "فراولة" },
    { src: `${BASE}/rvit-beta-alanine-neutral.png`, label: "بدون نكهة" },
  ],
};
