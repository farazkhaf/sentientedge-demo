import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/storage/database";
import { getAvailability } from "@/lib/storage/availability";
import { getServerDataset } from "@/lib/storage/server-dataset";

export async function GET() {
  try {
    const availability = await getAvailability(await getDatabase());
    if (availability.state === "offline")
      return NextResponse.json(
        { error: availability.message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const dataset = await getServerDataset();
    return NextResponse.json(
      { snapshot: dataset.snapshot, availability },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The workspace is temporarily unavailable. Please try again later.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
