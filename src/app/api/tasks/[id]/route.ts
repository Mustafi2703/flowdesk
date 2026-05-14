import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTaskDTO } from "@/lib/serialize-task";
import { applyPatch, type PatchBody } from "@/lib/task-patch";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as Partial<PatchBody>;
    if (!body.actorId || !body.action) {
      return NextResponse.json({ error: "actorId and action are required." }, { status: 400 });
    }
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch: PatchBody = {
      actorId: body.actorId,
      action: body.action,
      note: body.note,
    };

    let status: string;
    let timeline: object[];
    try {
      const out = applyPatch(task, patch);
      status = out.status;
      timeline = out.timeline as object[];
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const row = await prisma.task.update({
      where: { id },
      data: { status, timeline },
    });
    return NextResponse.json(toTaskDTO(row));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}
