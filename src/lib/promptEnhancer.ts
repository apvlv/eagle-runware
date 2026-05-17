import type { ModelId } from './models';
import { getClient, uploadReferenceImage, type ImageRef } from './runware';

const ENHANCER_MODEL = 'openai:gpt@5.4';

const GENERIC_BRIEF = `You are briefing an LLM that will act as a professional prompt artist for generative image and video models. Apply these rules for every model unless the model-specific section says otherwise.

ROLE: Professional prompt artist — specific, evocative, detailed. Expand the user's idea; never shorten or oversimplify.

OUTPUT LENGTH: Sufficient and very detailed. Aim for 30–80+ words for image models; longer for complex scenes. Include: materials, textures, atmosphere, era, camera/lens references where helpful.

STRUCTURE (use when the model benefits):
- Subject / Scene: main focus, action, pose, key elements
- Style & Mood: artistic approach, aesthetic, emotional tone, references (e.g. "editorial fashion", "80s vintage")
- Lighting: type, direction, quality, time of day, film look if relevant
- Color / Palette: dominant colors; hex codes (e.g. #FF5733) when the model supports them
- Composition / Camera: framing, angle, lens, depth of field, "shot on X camera"
- Context / Background: setting, environment, atmosphere
For video: add Shot timing (e.g. [0-3s]), Camera movement (push, pull, pan), Motion description.

SOURCES TO EMULATE: Black Forest Labs FLUX.2 Prompt Guide, Nano Banana Pro Prompt Libraries, WAN 2.6 and fal.ai guides, professional prompt artists. Prefer natural flowing prose over keyword lists unless the model explicitly favors tags.`;

const NBP_BRIEF = `## Nano Banana Pro Prompting Brief (for an LLM that writes prompts)

### Purpose
This document instructs you (the LLM) how to write **high-performing prompts for the model \`fal-ai/nano-banana-pro\` (Nano Banana Pro / Nano Banana 2)**. This model is **reasoning-guided** (Plan → Evaluate → Improve), excels at **accurate typography**, **complex spatial relationships**, and **technical/diagrammatic structure**—when prompts are written as **explicit requirements**, not vague keyword lists.

Your job: produce prompts that are **specific, logically testable, and composition-aware**, written in **clear natural language** (not "comma soup"), with optional structured sections.

---

## 1) Recommended Prompt Structure (section order)
Use this order unless the user's request demands a different structure. Keep headings short and consistent.

1) **Subject / Scene (what it is)**
- The primary subject(s) and what is happening.
- Identify exact objects that must appear (and must not).
- If people are present, specify count, apparent age range, wardrobe, and pose/action (as needed).

2) **Context & Environment (where it is)**
- Location, background elements, time period, weather, props.
- For product/UI: describe the surface, surrounding objects, and practical context.

3) **Style & Mood (how it should feel)**
- Photorealistic vs illustration vs diagram vs UI mockup.
- References like "ultra-realistic product photography," "medical textbook illustration," "clean SaaS UI mockup," etc.

4) **Typography / Labels (if any text appears)**
Nano Banana Pro is strong at text, but only if you specify it precisely:
- Put every required text string in quotes.
- Specify placement ("centered at top," "on the sign above the door," "button label").
- Limit to **3–5 text elements** per image for best reliability.
- Prefer standard, readable typography unless the user requests novelty.

5) **Lighting**
- Type (softbox, daylight, rim light), direction, softness, contrast.
- For diagrams/UI, lighting may be irrelevant—omit or specify "flat, even lighting."

6) **Color / Palette**
- Describe mood and dominant colors.
- If supported/desired, include **hex colors** for brand/precise palettes.

7) **Composition & Camera**
- Shot type (close-up, medium, wide), angle (eye-level, high angle), lens feel (e.g., 50mm look).
- Layout rules (rule of thirds, centered symmetry), depth of field.
- For aspect ratios: describe how content should be arranged to fit (e.g., "leave negative space at top for headline").

8) **Constraints / Musts & Must-nots**
- "Text must read exactly…"
- "No extra logos, no watermark, no gibberish text."
- For diagrams: require correct leader lines/arrows and correct relationships.

> Tip: When prompting Nano Banana Pro, you're giving instructions to a validator. Write requirements the model can verify.

---

## 2) Do's and Don'ts

### Do
- **Be specific and concrete**: exact objects, positions, relationships.
- **Use natural sentences** with a few clear sections. Prefer: short paragraphs over keyword dumps.
- **Specify spatial logic explicitly**:
  - "Poster is behind the viewer; its text is visible in the mirror reflection."
  - "Label lines point to the correct anatomical structures."
- **Use quotes for all text**: \`"OPEN"\`, \`"SALE"\`, \`"Receive Order"\`.
- **State hierarchy and layout**: what is the focal point, what is secondary, where empty space should be.
- **Use product-photo conventions** when relevant:
  - Surface type, material finish, reflections, soft shadows.
- **Keep text elements limited** (3–5) for maximum consistency.
- **Prefer standard fonts** unless a specific type style is required.

### Don't
- Don't write "comma soup" (long chains of tags). Avoid: \`photorealistic, 8k, ultra, highly detailed, stunning, award-winning...\`
- Don't be vague about text: avoid "a sign says open" (use \`"OPEN"\` and placement).
- Don't overload with too many independent requirements (especially many text blocks).
- Don't rely on implicit assumptions ("it should look premium") without specifying what creates that look (lighting, materials, palette, typography).
- Don't request contradictory compositions ("centered" and "rule of thirds left") unless you reconcile them.

---

## 3) Length and Style Guidelines
- Target **120–250 words** for most prompts.
- Complex scenes/diagrams/UI may run **250–450 words**.
- Use **simple headings** and short paragraphs. Minimal bullet lists are fine for labels/flowcharts.
- Write like a **creative brief**: explicit, testable, with clear priorities.

---

## 4) Special Guidance for Typography, UI, Diagrams, and Spatial Reasoning

### Typography (signs, posters, packaging, UI)
Include:
- Exact text in quotes.
- Position and alignment: "centered," "top-left," "on the door glass."
- Material/implementation: neon tubing, printed label, embossed embroidery, UI text.
- Constraints: "No other text anywhere."

Example of strong text instruction:
- *"Neon sign above the entrance, text reads exactly 'OPEN', all caps, evenly spaced letters, warm pink neon glow."*

### Diagrams, equations, and labeled technical visuals
Specify:
- The diagram type (flowchart, schematic, anatomy).
- Required labels in quotes.
- Relationship rules: arrows direction, leader lines pointing to correct features.
- Style: "medical textbook," "clean vector infographic," "whiteboard marker."

### Mirrors/reflections and tricky spatial layouts
State what appears in reflection vs in reality.
- *"Poster is only visible in the mirror reflection; towel text is on the real towel, not in the reflection."*
If reversal matters, ask explicitly (e.g., mirror-reversed text in reflection).

---

## 5) Prompt Output Template (use as default)
Use this template when generating a final prompt for the user:

**Subject/Scene:** …
**Context:** …
**Style/Mood:** …
**Text (exact):** …
**Lighting:** …
**Color/Palette:** …
**Composition/Camera:** …
**Constraints:** …

(You may omit irrelevant sections.)`;

const OUTPUT_RULES = `

---

OUTPUT RULES (critical):
- Return ONLY the final enhanced prompt as plain text that the image model can consume directly.
- Do NOT include any preamble, explanation, commentary, or meta-discussion.
- Do NOT wrap the output in markdown code fences or quote it.
- Do NOT prefix with labels like "Prompt:" or "Here is…".
- If the brief above suggests a structured template, you MAY use bold section headings (e.g. **Subject/Scene:**) inline — but only when they help the image model. Otherwise use natural flowing prose.`;

type TextMessage = { role: 'user' | 'assistant'; content: string };
interface TextInferenceSettings {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}
interface TextInferencePayload {
  model: string;
  messages: TextMessage[];
  settings?: TextInferenceSettings;
  numberResults?: number;
  includeCost?: boolean;
}

function buildUserMessage(
  model: ModelId,
  userPrompt: string,
  referenceCaptions: string[],
): string {
  const brief = model === 'nano-banana-pro' ? NBP_BRIEF : GENERIC_BRIEF;
  const referenceBlock =
    referenceCaptions.length > 0
      ? `\n\n---\n\nREFERENCE IMAGES (the user attached these — analyzed by a vision model):\n${referenceCaptions
          .map((c, i) => `Reference ${i + 1}: ${c}`)
          .join('\n\n')}\n\nWeave the visual qualities of these references (subject, style, lighting, palette, composition) into the rewritten prompt so the image model can use them as inspiration. The references will ALSO be sent to the image model directly, so describe what to borrow from them — don't merely re-describe them.`
      : '';
  return `${brief}${OUTPUT_RULES}${referenceBlock}

---

USER PROMPT TO REWRITE:
${userPrompt}`;
}

interface CaptionResult {
  text?: string;
}

async function captionReferences(refs: ImageRef[]): Promise<string[]> {
  if (refs.length === 0) return [];
  const client = getClient();
  const sdk = client as unknown as {
    requestImageToText?: (
      p: { inputImage: string; includeCost?: boolean },
    ) => Promise<CaptionResult>;
    caption?: (p: { inputImage: string; includeCost?: boolean }) => Promise<CaptionResult>;
  };
  const captionFn = sdk.requestImageToText ?? sdk.caption;
  if (typeof captionFn !== 'function') {
    throw new Error('Runware SDK is missing requestImageToText — cannot analyze references.');
  }
  const uploadedRefs = await Promise.all(refs.map((r) => uploadReferenceImage(client, r)));
  const captions = await Promise.all(
    uploadedRefs.map(async (inputImage) => {
      try {
        const res = await captionFn.call(sdk, { inputImage, includeCost: true });
        const text = typeof res?.text === 'string' ? res.text.trim() : '';
        return text || '(no caption)';
      } catch (err) {
        console.warn('[Runware] requestImageToText failed for a reference:', err);
        return '(caption failed)';
      }
    }),
  );
  return captions;
}
interface TextInferenceResult {
  text?: string;
  content?: string;
  message?: { content?: string } | string;
}

function pickResultText(r: TextInferenceResult | undefined): string {
  if (!r) return '';
  if (typeof r.text === 'string' && r.text.trim()) return r.text;
  if (typeof r.content === 'string' && r.content.trim()) return r.content;
  if (r.message) {
    if (typeof r.message === 'string') return r.message;
    if (typeof r.message.content === 'string') return r.message.content;
  }
  return '';
}

function stripWrappers(s: string): string {
  let out = s.trim();
  const fence = out.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();
  // Strip a single leading label like "Prompt:" if present.
  out = out.replace(/^(?:enhanced prompt|prompt)\s*[:\-—]\s*/i, '');
  return out.trim();
}

function extractSdkErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    for (const entry of err) {
      const msg = extractSdkErrorMessage(entry);
      if (msg) return msg;
    }
    return null;
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.errorMessage === 'string' && o.errorMessage) return o.errorMessage;
    if (o.error) {
      const nested = extractSdkErrorMessage(o.error);
      if (nested) return nested;
    }
    if (Array.isArray(o.errors)) {
      const nested = extractSdkErrorMessage(o.errors);
      if (nested) return nested;
    }
  }
  return null;
}

function toReadableError(err: unknown): Error {
  if (err instanceof Error) return err;
  const msg = extractSdkErrorMessage(err);
  if (msg) return new Error(msg);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

export interface EnhancePromptOptions {
  references?: ImageRef[];
}

export async function enhancePrompt(
  model: ModelId,
  userPrompt: string,
  opts: EnhancePromptOptions = {},
): Promise<string> {
  const trimmed = userPrompt.trim();
  if (!trimmed) throw new Error('Enter a prompt before enhancing.');

  const client = getClient() as unknown as {
    textInference?: (
      p: TextInferencePayload,
    ) => Promise<TextInferenceResult | TextInferenceResult[]>;
  };
  if (typeof client.textInference !== 'function') {
    throw new Error('Runware SDK is missing textInference — please upgrade @runware/sdk-js.');
  }

  let referenceCaptions: string[] = [];
  const refs = opts.references ?? [];
  if (refs.length > 0) {
    try {
      referenceCaptions = await captionReferences(refs);
    } catch (err) {
      console.warn('[Runware] reference captioning failed:', err);
      throw toReadableError(err);
    }
  }

  let result: TextInferenceResult | TextInferenceResult[];
  try {
    result = await client.textInference({
      model: ENHANCER_MODEL,
      messages: [
        { role: 'user', content: buildUserMessage(model, trimmed, referenceCaptions) },
      ],
      settings: {
        temperature: 1,
        topP: 0.95,
        maxTokens: 4096,
      },
      numberResults: 1,
      includeCost: true,
    });
  } catch (err) {
    console.warn('[Runware] textInference failed:', err);
    throw toReadableError(err);
  }

  const first = Array.isArray(result) ? result[0] : result;
  const text = pickResultText(first);
  if (!text.trim()) {
    console.warn('[Runware] textInference response had no text field:', result);
    throw new Error('Prompt enhancer returned an empty response.');
  }
  return stripWrappers(text);
}
