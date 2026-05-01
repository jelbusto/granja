import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
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

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  return NextResponse.json({ informe: text });
}
