import { prisma } from "../src/lib/db";

const stripHamzas = (text: string | null) => {
  if (!text) return text;
  return text.replace(/[أإآ]/g, "ا");
};

async function main() {
  console.log("Fetching exercises...");
  const exercises = await prisma.exercises.findMany();
  let exCount = 0;
  for (const ex of exercises) {
    const strippedName = stripHamzas(ex.name_ar);
    const strippedTarget = stripHamzas(ex.target_muscle);
    const strippedCat = stripHamzas(ex.category);

    if (strippedName !== ex.name_ar || strippedTarget !== ex.target_muscle || strippedCat !== ex.category) {
      await prisma.exercises.update({
        where: { id: ex.id },
        data: {
          name_ar: strippedName!,
          target_muscle: strippedTarget,
          category: strippedCat,
        },
      });
      exCount++;
    }
  }
  console.log(`Updated ${exCount} exercises.`);

  console.log("Fetching nutrition sources...");
  const foods = await prisma.nutrition_sources.findMany();
  let foodCount = 0;
  for (const food of foods) {
    const strippedName = stripHamzas(food.name);
    const strippedCat = stripHamzas(food.category);

    if (strippedName !== food.name || strippedCat !== food.category) {
      await prisma.nutrition_sources.update({
        where: { id: food.id },
        data: {
          name: strippedName!,
          category: strippedCat || "",
        },
      });
      foodCount++;
    }
  }
  console.log(`Updated ${foodCount} nutrition sources.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
