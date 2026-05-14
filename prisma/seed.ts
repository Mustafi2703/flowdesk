import { PrismaClient } from "@prisma/client";
import { SEED_TASKS } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  for (const t of SEED_TASKS) {
    await prisma.task.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        title: t.title,
        desc: t.desc,
        brand: t.brand,
        assignedTo: t.assignedTo,
        assignedBy: t.assignedBy,
        priority: t.priority,
        due: new Date(t.due),
        status: t.status,
        createdAt: new Date(t.createdAt),
        timeline: [...t.timeline] as object[],
      },
      update: {
        title: t.title,
        desc: t.desc,
        brand: t.brand,
        assignedTo: t.assignedTo,
        assignedBy: t.assignedBy,
        priority: t.priority,
        due: new Date(t.due),
        status: t.status,
        createdAt: new Date(t.createdAt),
        timeline: [...t.timeline] as object[],
      },
    });
  }
  console.log(`Seeded ${SEED_TASKS.length} tasks.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
