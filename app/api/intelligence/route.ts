import { type NextRequest, NextResponse } from "next/server";
import { dimensions, type BriefingKind } from "@/lib/intelligence/briefings";
import { getServerDataset } from "@/lib/storage/server-dataset";
import { getDatabase } from "@/lib/storage/database";
import { getAvailability } from "@/lib/storage/availability";

async function respond(request: NextRequest) {
  const availability = await getAvailability(await getDatabase());
  if (availability.state === "offline")
    return NextResponse.json({ error: availability.message }, { status: 503 });
  const { dataService, areaBriefing, briefings, evidenceById, recordsFor } =
    await getServerDataset();
  const params = request.nextUrl.searchParams;
  const areaId = params.get("area");
  const kind = params.get("kind") ?? "combined";
  if (!["combined", "news", "social"].includes(kind))
    return NextResponse.json(
      { error: "Unknown briefing kind." },
      { status: 400 },
    );
  const area = areaId ? areaBriefing(areaId) : null;
  if (areaId && !area)
    return NextResponse.json({ error: "Unknown Miami area." }, { status: 404 });
  const name = areaId
    ? dataService.getAllDataForNeighborhood(areaId)!.name
    : "Miami";
  const section = area
    ? area[kind as BriefingKind]
    : briefings.city[kind as BriefingKind];
  const records = recordsFor(areaId, kind as BriefingKind);
  if (params.get("format") === "markdown") {
    const lines = [
      `# SentientEdge · ${name}`,
      "",
      `May 2026 · preserved demo snapshot`,
      "",
      `## ${section.headline}`,
      "",
      section.summary,
      "",
    ];
    for (const theme of section.themes) {
      lines.push(
        `### ${theme.title}`,
        "",
        theme.summary,
        "",
        "Supporting records:",
        "",
      );
      for (const id of theme.recordIds) {
        const record = evidenceById.get(id);
        if (!record) continue;
        lines.push(
          `- ${record.areaName} · ${record.date.slice(0, 10)}: ${record.text}`,
          ...record.sources.map((s) => `  [${s.name}](${s.url})`),
        );
      }
      lines.push("");
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="sentientedge-${areaId ?? "miami"}-${kind}.md"`,
      },
    });
  }
  return NextResponse.json({
    snapshot: { id: briefings.id, label: briefings.label },
    area: { id: areaId ?? "miami", name },
    kind,
    briefing: section,
    dimensions: areaId
      ? dimensions.map((d) => ({
          id: d.id,
          label: d.label,
          meaning: d.meaning,
          score: dataService.getDimensionScore(areaId, d.id),
        }))
      : [],
    records,
  });
}

export async function GET(request: NextRequest) {
  try {
    const response = await respond(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: "The workspace is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
