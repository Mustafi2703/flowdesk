import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTaskDTO } from "@/lib/serialize-task";
import { isManagerId } from "@/lib/constants";
import { timelineForNewAssignment } from "@/lib/task-patch";

export async function GET() {
  try {
    const rows = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(rows.map(toTaskDTO));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database unavailable. Set DATABASE_URL to your Railway Postgres URL." },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      desc?: string;
      assignedTo?: string;
      brand?: string;
      priority?: string;
      due?: string;
      assignedBy?: string;
    };
    const { title, desc = "", assignedTo, brand, priority, due, assignedBy } = body;
    if (!title?.trim() || !assignedTo || !due || !assignedBy) {
      return NextResponse.json({ error: "title, assignedTo, due, and assignedBy are required." }, { status: 400 });
    }
    if (!isManagerId(assignedBy)) {
      return NextResponse.json({ error: "Only managers can assign tasks." }, { status: 403 });
    }
    const id = `t${Date.now()}`;
    const createdAt = new Date();
    const row = await prisma.task.create({
      data: {
        id,
        title: title.trim(),
        desc,
        brand: brand ?? "Dinamoo",
        assignedTo,
        assignedBy,
        priority: priority ?? "Medium",
        due: new Date(due),
        status: "assigned",
        createdAt,
        timeline: timelineForNewAssignment(assignedBy) as object[],
      },
    });
    return NextResponse.json(toTaskDTO(row));
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
