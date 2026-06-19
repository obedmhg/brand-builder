import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Initialize GoogleGenAI client lazy-loaded to prevent startup crashes if key is initially empty
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured in Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Media configurations available on the backend
const MEDIUMS_CONFIG: Record<string, { name: string; description: string; aspectRatio: string; vibe: string; instructions: string }> = {
  billboard: {
    name: "City Billboard",
    description: "A wide-screen electronic billboard on a sleek architectural mount, hovering high in a premium urban city district at dusk. High-contrast ambient display, empty of humans.",
    aspectRatio: "16:9",
    vibe: "modern commercial storefront/billboard banner",
    instructions: "Frame the product as a grand outdoor advertisement printed on a colossal modern city billboard. Show the massive billboard structure cleanly blending into a minimalist cityscape with a dramatic twilight sky background. The product is the absolute main focus. No people, no crowds, no silhouettes, no hands."
  },
  newspaper: {
    name: "Halftone Newspaper Ad",
    description: "A vintage, high-contrast monochrome printing-press halftone ink advertisement on a textured paper page. Striking block layout.",
    aspectRatio: "4:3",
    vibe: "halftone print advertisement style",
    instructions: "Represent the product as a printed advertisement in a high-quality newspaper. The image has a distinctive ink halftone pattern, black and white or sepia monochrome paper texture, and structured print borders. No people or human hands are holding or reading the paper. The focus is entirely on the product ad on the printed page."
  },
  social_post: {
    name: "Studio Social Feed square",
    description: "A sleek, square-cut social media photography layout. Studio lighting, soft color gradients, crisp metallic/glass details, perfect for modern feeds.",
    aspectRatio: "1:1",
    vibe: "highly polished professional social advertising",
    instructions: "Represent the product as a premium social media advertisement post. The product stands on a geometric podium with soft, high-end studio lighting, elegant water reflections, or subtle prism glass diffraction. Clean atmospheric shadows. No people, hands, or background distractions exist."
  },
  magazine: {
    name: "Editorial Magazine Ad",
    description: "A sophisticated portrait-orientation layout reminiscent of a high-end fashion or lifestyle publication. Minimalist layout with dramatic margins.",
    aspectRatio: "3:4",
    vibe: "editorial magazine advertisement",
    instructions: "Frame the product as an elegant full-page portrait advertisement in a luxury lifestyle magazine. Crisp focus, soft depth-of-field, subtle studio background shadows matching the product's color palette. Absolutely no people or faces in the frame."
  },
  bus_stop: {
    name: "Illuminated Bus Shelter Poster",
    description: "An elegant vertical light-box advertisement poster integrated inside a modern glass bus shelter, shining at night with misty street lighting behind.",
    aspectRatio: "9:16",
    vibe: "vertical light-box poster design",
    instructions: "Represent the product on an illuminated vertical poster inside a sleek glass bus shelter. The shelter is situated on a quiet, clean street at night, with streetlights causing elegant bokeh glows in the misty background. The illuminated poster itself stands out brightly with the product displayed with supreme clarity. Absolutely no people, passengers, or pedestrians exist in the scene."
  }
};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString()
  });
});

// Endpoint to analyze the product and create a consistent "Brand Anchor Profile"
app.post("/api/brand/analyze", async (req, res) => {
  try {
    const { name, description, tagline, vibe } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: "Product name and description are required." });
    }

    const ai = getGenAI();

    const systemPrompt = `You are an elite creative director and brand strategist.
Your task is to analyze a raw product description and return a structured JSON response to create an immutable "Consistent Product Anchor Profile".
This anchor profile consists of a highly detailed, extremely specific physical description of the product.
This description will be appended verbatim to subsequent image-generation prompts to ensure the product looks identical and consistent across every scene.

In your description, make sure to detail:
1. Exact colors, finish, and materials (e.g. "matte powder-coated crimson red stainless steel with active brushed gold metal caps").
2. Core geometric shape, structure, and sizing details (with no humans used for scale).
3. Any decals, logo style, or typography characteristics (e.g., "a minimalist screen-printed white illustration of a pine tree on the center container, with a clean sans-serif tagline").
4. Finish quality (e.g., "soft diffused reflections, professional studio manufacturing finish").
5. ABSOLUTE NEGATIVE PATTERNS: Enforce that the product description must NEVER rely on or mention hands, human use, or human proportions. Maintain absolute isolation of the product object to help the generator.

You must return a JSON response matching this schema:
{
  "productName": "Shorter, punchy refined title",
  "refinedDescription": "A beautiful, evocative 1-2 sentence marketing summary of the product's value and feel.",
  "visualElementsDetail": "A single dense, comma-separated details string (100-150 words) detailing the exact physical appearance, colors, branding, surface finishes, and geometry of the item, suitable for direct copy-paste consistency into an AI image generator."
}`;

    const prompt = `Please create the Brand Profile for:
Product Name: "${name}"
Raw Description: "${description}"
Tagline (optional): "${tagline || ""}"
Intended Vibe: "${vibe || "modern"}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING },
            refinedDescription: { type: Type.STRING },
            visualElementsDetail: { type: Type.STRING },
          },
          required: ["productName", "refinedDescription", "visualElementsDetail"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from analysis model.");
    }

    const profile = JSON.parse(resultText.trim());
    res.json(profile);
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during brand analysis." });
  }
});

// Endpoint to generate an image using Nano-Banana image models
app.post("/api/brand/generate-medium", async (req, res) => {
  try {
    const { input, anchorProfile, mediumId } = req.body;
    if (!input || !anchorProfile || !mediumId) {
      return res.status(400).json({ error: "Input product, brand profile, and medium id are required." });
    }

    const mediumCfg = MEDIUMS_CONFIG[mediumId];
    if (!mediumCfg) {
      return res.status(400).json({ error: `Unknown advertising medium identifier: ${mediumId}` });
    }

    const ai = getGenAI();

    // Use gemini-3.5-flash to combine the product profile and medium configuration into a pristine, customized prompt
    const promptGeneratorInstruction = `You are an expert AI prompt engineer specializing in image generation models.
Your job is to write a single, highly descriptive prompt to generate an advertisement image for a specific product.
You must synthesize the provided Immutable Product description and the Target Advertising Medium environment.

GUIDELINES:
1. Maintain extreme product consistency by utilizing and integrating all key visual details provided about the product.
2. Emphasize the environment specified in the Medium configuration guidelines.
3. STRICT NO-PEOPLE RULE: The prompt must explicitly and implicitly guarantee that NO humans, hands, faces, crowds, silhouettes, or reflections of people are present in the image. The environment must be completely vacant of humans.
4. Keep the product as the absolute visual focal point of the scene.
5. Add rich descriptive modifiers for lighting, quality, texture, and style (e.g., photorealistic, crisp editorial detail, corporate advertising shot, pristine materials, beautiful atmospheric twilight bokeh).
6. Do not include any meta-text, introductory, or descriptive wrappers in your response. Output ONLY the raw image generation prompt string (between 80 to 180 words). No headers, no quotes.`;

    const promptGeneratorTask = `Product Name: ${anchorProfile.productName}
Product Refined Description: ${anchorProfile.refinedDescription}
Product Visual Blueprint (MUST BE INTEGRATED EXACTLY): ${anchorProfile.visualElementsDetail}
Target Advertising Medium: ${mediumCfg.name}
Medium Core Atmosphere & Setup: ${mediumCfg.instructions}
Intended Vibe: ${input.vibe}`;

    const promptOutput = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptGeneratorTask,
      config: {
        systemInstruction: promptGeneratorInstruction,
      },
    });

    const finalImagePrompt = promptOutput.text?.trim() || `${anchorProfile.refinedDescription}, ${anchorProfile.visualElementsDetail}, advertised in a ${mediumCfg.vibe}, photograph, hyper-realistic, professional lighting, clean scene, no people.`;

    console.log(`Generated prompt for ${mediumId}: "${finalImagePrompt}"`);

    const selectedModel = input.model || "gemini-2.5-flash-image";

    // Call the Nano-Banana model
    const imageResponse = await ai.models.generateContent({
      model: selectedModel,
      contents: {
        parts: [
          {
            text: finalImagePrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: mediumCfg.aspectRatio,
          // Only add imageSize if model is gemini-3.1-flash-image
          ...(selectedModel === "gemini-3.1-flash-image" ? { imageSize: "1K" } : {}),
        },
      },
    });

    let base64Data: string | null = null;

    // Search for inlineData in parts
    const candidates = imageResponse.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Data = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Data) {
      throw new Error(`The Nano-Banana model did not return image data for the generated prompt.`);
    }

    res.json({
      mediumId,
      promptUsed: finalImagePrompt,
      imageUrl: `data:image/png;base64,${base64Data}`,
    });

  } catch (error: any) {
    console.error("Generate Medium API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred during image generation." });
  }
});

// Setup Vite & static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Brand Builder Server running on port ${PORT}`);
  });
}

startServer();
