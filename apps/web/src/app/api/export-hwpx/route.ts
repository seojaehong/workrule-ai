import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const apiBaseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/documents/export-hwpx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
        "Content-Disposition":
          response.headers.get("Content-Disposition") ?? 'attachment; filename="draft.hwpx"',
      },
    });
  } catch (error) {
    console.error("HWPX export proxy failed:", error);
    return NextResponse.json(
      {
        detail: "백엔드 API에 연결하지 못했습니다. apps/api 서버가 실행 중인지 확인해 주세요.",
      },
      { status: 502 },
    );
  }
}
