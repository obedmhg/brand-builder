import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Layers, 
  Tv, 
  Newspaper, 
  Instagram, 
  BookOpen, 
  MapPin, 
  RotateCcw, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  Layers2,
  Lock,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BrandProject, ProductInput, MediumConfig, MediumResult } from "./types";

// Configuration for mediums with their corresponding icon component
const MEDIUMS_METADATA: Record<string, { name: string; description: string; helperText: string; sizeText: string; icon: React.ReactNode; color: string }> = {
  billboard: {
    name: "City Billboard",
    description: "Wide landscape banner in public city backdrop.",
    sizeText: "16:9 Aspect Ratio",
    helperText: "Twilight cityscape neon glows, towering highway mounting frame.",
    icon: <Tv className="w-5 h-5 text-indigo-500" />,
    color: "from-indigo-500/10 to-blue-500/10 border-indigo-200/50"
  },
  newspaper: {
    name: "Halftone Newspaper Ad",
    description: "Vintage grayscale layout with dither ink details.",
    sizeText: "4:3 Aspect Ratio",
    helperText: "Classic printed newspaper columns with dither dot-matrix texture.",
    icon: <Newspaper className="w-5 h-5 text-amber-600" />,
    color: "from-amber-600/10 to-orange-500/10 border-amber-200/50"
  },
  social_post: {
    name: "Studio Social Feed square",
    description: "Polished square composition featuring the product as center-stage.",
    sizeText: "1:1 Aspect Ratio",
    helperText: "High-spec studio reflection backdrop, modern social marketing glow.",
    icon: <Instagram className="w-5 h-5 text-pink-500" />,
    color: "from-pink-500/10 to-purple-500/10 border-pink-200/50"
  },
  magazine: {
    name: "Editorial Magazine Ad",
    description: "Premium vertical layout mimicking a luxury design catalog.",
    sizeText: "3:4 Aspect Ratio",
    helperText: "Clean geometric margins, high-end editorial lighting, aesthetic shadows.",
    icon: <BookOpen className="w-5 h-5 text-emerald-500" />,
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200/50"
  },
  bus_stop: {
    name: "Illuminated Bus Shelter Poster",
    description: "High-impact vertical light-box set in street night bokeh.",
    sizeText: "9:16 Aspect Ratio",
    helperText: "Rain-glistening glass pavement reflections, misty glowing street lamps.",
    icon: <MapPin className="w-5 h-5 text-rose-500" />,
    color: "from-rose-500/10 to-red-500/10 border-rose-200/50"
  }
};

const VIBE_PRESETS = [
  { id: "modern", name: "Minimal & Modern", desc: "Clean lines, pastel backdrops, high-end industrial style" },
  { id: "retro", name: "Retro / Vintage", desc: "Warm grain, nostalgic chromatic tints, physical press textures" },
  { id: "luxury", name: "Premium & Luxury", desc: "Velvet textures, gold/obsidian accents, rich geometric shadows" },
  { id: "futuristic", name: "Futuristic / Neo-tech", desc: "Laser refraction, dark carbon-fiber, vivid sub-glows" },
  { id: "earthy", name: "Organic & Earthy", desc: "Raw stone elements, soft leaf shadows, natural linen drapes" },
];

export default function App() {
  // Input fields state
  const [productInput, setProductInput] = useState<ProductInput>({
    name: "SipStream Insulated",
    description: "A double-walled stainless steel travel bottle. It features a matte cobalt-blue powder coat, a brushed titanium magnetic cap, and a subtle mountain logo etched on its lower third.",
    tagline: "Uncompromising temperature, anywhere.",
    vibe: "modern",
    model: "gemini-2.5-flash-image",
  });

  // Project state
  const [activeProject, setActiveProject] = useState<BrandProject | null>(null);
  
  // App UI state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzingError, setAnalyzingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all"); // "all", or active medium ID
  const [showPromptForMedium, setShowPromptForMedium] = useState<Record<string, boolean>>({});
  const [keyStatus, setKeyStatus] = useState<{ checked: boolean; hasKey: boolean; error?: string }>({ 
    checked: false, 
    hasKey: false 
  });

  // Check key health on load
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setKeyStatus({
        checked: true,
        hasKey: data.hasApiKey,
      });
    } catch (err: any) {
      setKeyStatus({
        checked: true,
        hasKey: false,
        error: "Could not establish connection to the backend server."
      });
    }
  };

  // Step 1: Analyze raw details and construct anchor profile
  const handleAnalyzeBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productInput.name.trim() || !productInput.description.trim()) {
      setAnalyzingError("Please fill out both the product name and description.");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzingError(null);

    try {
      const response = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productInput)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze product.");
      }

      const brandProfile = await response.json();
      
      // Initialize an empty project
      const initialResults: Record<string, MediumResult> = {};
      Object.keys(MEDIUMS_METADATA).forEach(mediumId => {
        initialResults[mediumId] = {
          mediumId,
          status: "idle"
        };
      });

      setActiveProject({
        id: "proj_" + Date.now(),
        createdAt: new Date().toLocaleTimeString(),
        input: { ...productInput },
        anchorProfile: brandProfile,
        results: initialResults
      });
    } catch (err: any) {
      console.error(err);
      setAnalyzingError(err.message || "An unexpected error occurred while analyzing the product.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Imagine (generate) a single medium shot
  const handleGenerateMedium = async (mediumId: string) => {
    if (!activeProject) return;

    // Set medium to generating
    setActiveProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        results: {
          ...prev.results,
          [mediumId]: {
            mediumId,
            status: "generating"
          }
        }
      };
    });

    try {
      const response = await fetch("/api/brand/generate-medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: activeProject.input,
          anchorProfile: activeProject.anchorProfile,
          mediumId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate advert for ${mediumId}`);
      }

      const result = await response.json();

      setActiveProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          results: {
            ...prev.results,
            [mediumId]: {
              mediumId,
              status: "success",
              imageUrl: result.imageUrl,
              promptUsed: result.promptUsed
            }
          }
        };
      });
    } catch (err: any) {
      console.error(err);
      setActiveProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          results: {
            ...prev.results,
            [mediumId]: {
              mediumId,
              status: "error",
              error: err.message || "Failed to imagine this layout."
            }
          }
        };
      });
    }
  };

  // Helper: Imagine all mediums in parallel
  const handleImagineAll = async () => {
    if (!activeProject) return;
    Object.keys(MEDIUMS_METADATA).forEach(mediumId => {
      handleGenerateMedium(mediumId);
    });
  };

  // Helper toggle prompts mapping
  const togglePromptView = (mediumId: string) => {
    setShowPromptForMedium(prev => ({
      ...prev,
      [mediumId]: !prev[mediumId]
    }));
  };

  // Helper download simulated base64 trigger
  const triggerDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased" id="brand-builder-root">
      
      {/* Top Banner & Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white brand-gradient">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">Brand Builder Studio</h1>
              <p className="text-xs text-slate-500">Maintain high product consistency across diverse advertising mediums</p>
            </div>
          </div>

          {/* Configuration and Status Info */}
          <div className="flex items-center gap-4 flex-wrap">
            {keyStatus.checked && (
              <div className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-2 border ${
                keyStatus.hasKey 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {keyStatus.hasKey ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Gemini API Connected</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Using User Secrets Auth Key</span>
                  </>
                )}
              </div>
            )}
            
            <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-mono border border-slate-200">
              Model: Nano-Banana (Image)
            </div>
          </div>

        </div>
      </header>

      {/* Main Studio Body Layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8" id="studio-workspace">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Input description & Anchor generation (45% Width) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Input card container */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden" id="product-initializer-card">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-900"></div>
              
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-display font-semibold text-slate-900">1. Product Blueprint</h2>
              </div>
              
              <form onSubmit={handleAnalyzeBrand} className="space-y-4">
                
                {/* Product Name */}
                <div>
                  <label htmlFor="prod-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Product Title
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    value={productInput.name}
                    onChange={(e) => setProductInput(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Chrome Hydrator, AeroRunner, Arc-Light Thermos"
                    className="w-full border border-slate-200 focus:border-slate-800 rounded-xl px-4 py-3 bg-slate-50/50 text-slate-900 font-medium placeholder-slate-400 focus:outline-none transition-all text-sm"
                  />
                </div>

                {/* Raw description */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="prod-desc" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Physical Details & Architecture
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Include materials, finishes, emblems</span>
                  </div>
                  <textarea
                    id="prod-desc"
                    required
                    rows={4}
                    value={productInput.description}
                    onChange={(e) => setProductInput(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide a specific account of the shape, surface finishes, colors, and design logo on the exterior..."
                    className="w-full border border-slate-200 focus:border-slate-800 rounded-xl p-4 bg-slate-50/50 text-slate-900 text-sm focus:outline-none transition-all resize-none leading-relaxed"
                  />
                </div>

                {/* Tagline */}
                <div>
                  <label htmlFor="prod-tagline" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Tagline (Optional text display)
                  </label>
                  <input
                    id="prod-tagline"
                    type="text"
                    value={productInput.tagline}
                    onChange={(e) => setProductInput(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="e.g. Absolute performance, everyday luxury"
                    className="w-full border border-slate-200 focus:border-slate-800 rounded-xl px-4 py-3 bg-slate-50/50 text-slate-900 text-sm focus:outline-none transition-all"
                  />
                </div>

                {/* Vibe Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Brand Vibe & Lighting Direction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIBE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setProductInput(prev => ({ ...prev, vibe: preset.id }))}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          productInput.vibe === preset.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-semibold text-xs">{preset.name}</div>
                        <div className={`text-[10px] truncate mt-0.5 ${productInput.vibe === preset.id ? "text-slate-300" : "text-slate-400"}`}>
                          {preset.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Select Nano-Banana Model
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProductInput(prev => ({ ...prev, model: "gemini-2.5-flash-image" }))}
                      className={`p-3 rounded-xl border text-center font-medium text-xs transition-all ${
                        productInput.model === "gemini-2.5-flash-image"
                          ? "bg-slate-900 text-white border-slate-900 glow-selected"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-bold">Nano-Banana</div>
                      <div className="text-[9px] opacity-80 mt-0.5">gemini-2.5-flash-image</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProductInput(prev => ({ ...prev, model: "gemini-3.1-flash-image" }))}
                      className={`p-3 rounded-xl border text-center font-medium text-xs transition-all ${
                        productInput.model === "gemini-3.1-flash-image"
                          ? "bg-slate-900 text-white border-slate-900 glow-selected"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-bold">Nano-Banana 2</div>
                      <div className="text-[9px] opacity-80 mt-0.5">gemini-3.1-flash-image</div>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    * Both high-quality image generation models are part of the Nano-Banana series. They run securely from the server backend.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md mt-6"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Anchored Profile...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Establish Brand Match Profile</span>
                    </>
                  )}
                </button>

              </form>

              {analyzingError && (
                <div className="mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{analyzingError}</p>
                </div>
              )}

            </div>

            {/* Anchor Profile Details box */}
            <AnimatePresence mode="wait">
              {activeProject && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden"
                  id="brand-anchor-blueprint"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                  
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Layers2 className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-display font-semibold text-slate-900">
                        Anchored Visual Blueprint
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
                      Locked Profile
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    This profile was engineered by Gemini to represent the core physical features of your brand. It is appended verbatim to every advertising shot to lock down product appearance.
                  </p>

                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Refined Brand Title
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {activeProject.anchorProfile.productName}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Slogan Vibe
                      </div>
                      <div className="text-xs text-slate-600 italic">
                        "{activeProject.anchorProfile.refinedDescription}"
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Verbatim Render Prompter (appended to all)
                      </div>
                      <p className="text-xs font-mono text-slate-700 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
                        {activeProject.anchorProfile.visualElementsDetail}
                      </p>
                    </div>
                  </div>

                  {/* Warning banner */}
                  <div className="mt-4 p-3 bg-zinc-950 text-zinc-100 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 border border-zinc-800">
                    <EyeOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-400">Strict Human Exclusion Active:</span> Prompts are pre-screened dynamically to ensure absolutely no human figures, shadows, hand shapes, or human faces appear in of any of the generated frames.
                    </div>
                  </div>

                  {/* Bulk run trigger */}
                  <div className="mt-6 border-t border-slate-100 pt-5 flex items-center justify-between gap-4">
                    <div className="text-xs text-slate-400 font-mono">
                      Ready to visualise in 5 mediums.
                    </div>
                    <button
                      onClick={handleImagineAll}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                    >
                      <span>Imagine All Mediums</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </section>

          {/* RIGHT COLUMN: Medium Advertising Sandbox (75% Width) */}
          <section className="lg:col-span-7 space-y-6">
            
            {/* Context/Empty State if brand is not analyzed yet */}
            <AnimatePresence mode="wait">
              {!activeProject ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs"
                  id="empty-studio-state"
                >
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6 border border-amber-100">
                    <Sparkles className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-slate-900 mb-2">Imagine Across Mediums</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
                    Enter your product details on the left, then click <strong>Establish Brand Match Profile</strong> to create an immutable physical visual identity profile. Once defined, you can render your product instantly across individual advertising environments with seamless shape consistency.
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                    <span>No people are shown</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span>Consistently structured renders</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Dashboard header for active project */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Project</div>
                      <h3 className="text-base font-bold text-slate-900 font-display">
                        Advertising Mediums: {activeProject.anchorProfile.productName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleImagineAll}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Run All Mediums</span>
                      </button>
                      <button
                        onClick={() => {
                          const conf = window.confirm("Reset active brand and start over?");
                          if (conf) setActiveProject(null);
                        }}
                        className="p-2 border border-slate-200 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                        title="Reset Studio"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Grid containing all 5 Advertising mediums */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="mediums-gallery">
                    {Object.entries(MEDIUMS_METADATA).map(([mediumId, meta]) => {
                      const result = activeProject.results[mediumId];
                      const isIdle = result.status === "idle";
                      const isGenerating = result.status === "generating";
                      const isSuccess = result.status === "success";
                      const isError = result.status === "error";

                      return (
                        <div 
                          key={mediumId} 
                          className={`bg-white border text-slate-900 rounded-2xl overflow-hidden shadow-xs flex flex-col hover:border-slate-300 transition-all ${
                            isSuccess ? "ring-1 ring-slate-100" : ""
                          }`}
                        >
                          {/* Medium Header */}
                          <div className={`p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r ${meta.color}`}>
                            <div className="flex items-center gap-2">
                              {meta.icon}
                              <div>
                                <h4 className="font-semibold text-xs text-slate-900 tracking-tight font-display">{meta.name}</h4>
                                <p className="text-[10px] text-slate-500">{meta.sizeText}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isIdle && (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-full">
                                  Idle
                                </span>
                              )}
                              {isGenerating && (
                                <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                                  Imaging...
                                </span>
                              )}
                              {isSuccess && (
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                                  Ready
                                </span>
                              )}
                              {isError && (
                                <span className="text-[10px] font-mono text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full font-bold">
                                  Error
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Image viewport / Interaction Frame */}
                          <div className="bg-slate-100 aspect-video w-full relative flex items-center justify-center overflow-hidden border-b border-slate-100">
                            
                            {/* Success Image view */}
                            {isSuccess && result.imageUrl && (
                              <div className="w-full h-full relative group">
                                <img
                                  src={result.imageUrl}
                                  alt={`${meta.name} - Consistent Product Mock`}
                                  className="w-full h-full object-cover select-none pointer-events-none"
                                  referrerPolicy="no-referrer"
                                />
                                
                                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => triggerDownload(result.imageUrl!, `${activeProject.anchorProfile.productName.toLowerCase().replace(/\s+/g, '_')}_${mediumId}.png`)}
                                    className="p-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-md transition-all scale-95 group-hover:scale-100"
                                    title="Download image"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => window.open(result.imageUrl, "_blank")}
                                    className="p-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-md transition-all scale-95 group-hover:scale-100"
                                    title="Open full size"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Generating State */}
                            {isGenerating && (
                              <div className="text-center p-6 space-y-3">
                                <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto"></div>
                                <div className="text-xs text-slate-600 font-medium animate-pulse">
                                  Imaging consistent product detail...
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono italic max-w-xs mx-auto">
                                  "{meta.helperText}"
                                </div>
                              </div>
                            )}

                            {/* Idle State */}
                            {isIdle && (
                              <div className="text-center p-6 max-w-xs space-y-3">
                                <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                                  {meta.icon}
                                </div>
                                <div className="text-xs text-slate-500 font-medium leading-normal">
                                  Ready to imagine this shot in its native aspect-ratio
                                </div>
                                <button
                                  onClick={() => handleGenerateMedium(mediumId)}
                                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all shadow-xs"
                                >
                                  Generate Shot
                                </button>
                              </div>
                            )}

                            {/* Error State */}
                            {isError && (
                              <div className="text-center p-4 max-w-xs space-y-3">
                                <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                                <div className="text-xs font-medium text-red-700">
                                  Failed to compile artwork
                                </div>
                                <p className="text-[10px] text-red-600 leading-normal line-clamp-2 bg-red-50 p-2 rounded-lg border border-red-100">
                                  {result.error || "Model timed out."}
                                </p>
                                <button
                                  onClick={() => handleGenerateMedium(mediumId)}
                                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all"
                                >
                                  Retry Generation
                                </button>
                              </div>
                            )}

                          </div>

                          {/* Action Bar / Details view */}
                          <div className="p-4 bg-slate-50/60 flex flex-col gap-3 shrink-0 mt-auto">
                            
                            <div className="text-xs text-slate-600 leading-normal">
                              {meta.description}
                            </div>

                            {/* Prompt inspect display */}
                            {isSuccess && result.promptUsed && (
                              <div className="border-t border-slate-100 pt-3">
                                <button
                                  onClick={() => togglePromptView(mediumId)}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 font-mono transition-colors uppercase tracking-wider flex items-center gap-1.5"
                                >
                                  {showPromptForMedium[mediumId] ? "Hide Final Prompt" : "Inspect Prompt Used"}
                                </button>
                                
                                {showPromptForMedium[mediumId] && (
                                  <div className="text-[10px] font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed mt-2 max-h-24 overflow-y-auto">
                                    {result.promptUsed}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Trigger action when not idle/generating */}
                            {(isSuccess || isError) && (
                              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                                <span className="text-[10px] font-mono text-slate-400">
                                  Model: {activeProject.input.model.split('-')[1]}
                                </span>
                                <button
                                  onClick={() => handleGenerateMedium(mediumId)}
                                  className="text-xs font-bold text-slate-900 hover:text-slate-600 transition-colors"
                                >
                                  Re-generate Shot
                                </button>
                              </div>
                            )}

                          </div>

                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12 text-center text-xs text-slate-400">
        <p>© 2026 Brand Builder Studio. Built securely with server-side Gemini 3.5 & Nano-Banana image models.</p>
        <p className="mt-2 text-[10px]">Strict No-People policies enforced across all design prompt pipelines.</p>
      </footer>

    </div>
  );
}
