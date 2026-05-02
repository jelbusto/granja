import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key no configurada." }, { status: 500 });
  }

  const { base64, mimeType } = await req.json() as { base64: string; mimeType: string };

  if (!base64) {
    return NextResponse.json({ error: "Imagen no proporcionada." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mimeType || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: `Analiza esta factura o ticket y extrae los siguientes campos en formato JSON (sin explicaciones adicionales):
{
  "fecha": "YYYY-MM-DD o null si no se puede determinar",
  "tipo": "comida|kilometros|billetes|hotel|otros",
  "descripcion": "descripción breve del gasto",
  "lugar": "nombre del establecimiento o lugar",
  "importe_total": número con decimales o null
}

Para el campo "tipo":
- comida: restaurantes, bares, cafeterías, supermercados
- kilometros: gasolineras, peajes, parking
- billetes: transporte público, avión, tren, taxi, VTC
- hotel: hoteles, hostales, alojamiento
- otros: cualquier otro tipo de gasto

Responde ÚNICAMENTE con el JSON, sin texto adicional.`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "No se pudo interpretar la respuesta de la IA.", raw: text }, { status: 422 });
  }
}
