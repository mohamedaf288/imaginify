import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { prompt, width = 768, height = 768, model } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Vérifier la clé API
    if (!process.env.HUGGINGFACE_API_KEY) {
      throw new Error("HUGGINGFACE_API_KEY is not configured");
    }

    console.log("Starting image generation with:", {
      prompt,
      width,
      height,
      model,
    });

    // Paramètres spécifiques selon le modèle
    const modelParams: any = {
      "stabilityai/stable-diffusion-xl-base-1.0": {
        negative_prompt: "blurry, bad quality, distorted",
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
      "stabilityai/stable-diffusion-2-1": {
        negative_prompt: "blurry, bad quality",
        num_inference_steps: 25,
        guidance_scale: 7.0,
      },
      "runwayml/stable-diffusion-v1-5": {
        negative_prompt: "blurry",
        num_inference_steps: 20,
        guidance_scale: 7.0,
      },
    };

    // Utilisation du modèle sélectionné avec ses paramètres spécifiques
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${
        model || "stabilityai/stable-diffusion-xl-base-1.0"
      }`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            ...modelParams[model || "stabilityai/stable-diffusion-xl-base-1.0"],
            width: Math.floor(width / 64) * 64,
            height: Math.floor(height / 64) * 64,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("HuggingFace API error:", error);

      // Messages d'erreur plus descriptifs
      if (error.error?.includes("loading")) {
        throw new Error("Model is loading, please try again in a few seconds");
      } else if (error.error?.includes("permission")) {
        throw new Error("Please check your API key and model permissions");
      }

      throw new Error(`API error: ${error.error || "Unknown error"}`);
    }

    // L'API retourne directement l'image en bytes
    const imageBlob = await response.blob();

    // Conversion du blob en base64
    const imageBuffer = await imageBlob.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Detailed error:", error);
    let errorMessage = "Failed to generate image";

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
