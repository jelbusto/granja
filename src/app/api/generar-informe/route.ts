import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada en el servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new Anthropic({ apiKey });

  const { transcripcion, granja, fechaVisita, veterinario, observaciones } =
    await req.json();

  if (!transcripcion?.trim()) {
    return new Response(JSON.stringify({ error: "Transcripción vacía" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = `Eres un veterinario. Reescribe el siguiente texto en lenguaje formal y profesional, como si fuera una nota de visita veterinaria oficial. Mantén toda la información del texto original, pero corrígela gramaticalmente y dale un tono técnico-formal. No añadas secciones ni estructura, solo redacta el texto de forma continua y fluida.

Datos de contexto (inclúyelos al inicio si no están en el texto):
- Granja: ${granja}
- Fecha de visita: ${fechaVisita}
- Veterinario: ${veterinario || "No especificado"}${observaciones?.trim() ? `\n- Observaciones adicionales: ${observaciones.trim()}` : ""}

Texto a reescribir:
${transcripcion}`;

  // Stream the response so Vercel doesn't time out on slow responses
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });

        let fullText = "";
        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            fullText += chunk.delta.text;
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ informe: fullText })));
      } catch (err: unknown) {
        let msg = err instanceof Error ? err.message : String(err);
        if (err && typeof err === "object" && "status" in err) {
          const ae = err as { status: number; message?: string };
          msg = `Anthropic ${ae.status}: ${ae.message ?? msg}`;
        }
        console.error("[generar-informe]", msg);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: msg }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/json" },
  });
}
