import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const apiBaseUrl = process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/ingestion/extract-text`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Ingestion proxy failed:", error);
    return NextResponse.json(
      {
        detail:
          "문서 추출 API에 연결하지 못했습니다. apps/api 서버가 실행 중인지 확인해 주세요.",
      },
      { status: 502 },
    );
  }
}
