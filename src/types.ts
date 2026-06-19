export interface ProductInput {
  name: string;
  description: string;
  tagline: string;
  vibe: string; // e.g., "modern", "retro", "luxury", "futuristic", "playful"
  model: "gemini-2.5-flash-image" | "gemini-3.1-flash-image";
}

export interface MediumConfig {
  id: string;
  name: string;
  description: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  imageSize?: "512px" | "1K" | "2K";
  iconName: string;
  promptGuideline: string;
}

export interface MediumResult {
  mediumId: string;
  status: "idle" | "generating" | "success" | "error";
  imageUrl?: string; // Data URL or object URL
  promptUsed?: string;
  error?: string;
}

export interface BrandProject {
  id: string;
  createdAt: string;
  input: ProductInput;
  anchorProfile: {
    productName: string;
    refinedDescription: string;
    visualElementsDetail: string; // Detail to append to every prompt for consistency
  };
  results: Record<string, MediumResult>;
}
