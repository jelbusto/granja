import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada en el servidor." },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const { transcripcion, granja, fechaVisita, veterinario, observaciones } =
    await req.json();

  if (!transcripcion?.trim()) {
    return NextResponse.json({ error: "Transcripción vacía" }, { status: 400 });
  }

  const prompt = `Eres un veterinario redactando un informe oficial de visita a una explotación ganadera de ganado lechero.
Basándote en la siguiente transcripción de voz, redacta un informe veterinario formal y estructurado en español.

Datos de la visita:
- Granja: ${granja}
- Fecha de visita: ${fechaVisita}
- Veterinario: ${veterinario || "No especificado"}
- Observaciones adicionales: ${observaciones?.trim() || "Ninguna"}

Transcripción de voz del veterinario:
${transcripcion}

Redacta el informe con las siguientes secciones claramente delimitadas:

1. DATOS DE LA VISITA
2. MOTIVO DE LA VISITA
3. HALLAZGOS CLÍNICOS
4. DIAGNÓSTICO
5. TRATAMIENTO Y RECOMENDACIONES
6. PRÓXIMA VISITA
7. OBSERVACIONES FINALES

Usa lenguaje técnico-veterinario formal. Si la transcripción no menciona alguna sección, indícalo brevemente.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");

    return NextResponse.json({ informe: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
