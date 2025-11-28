# Nano Banana API Reference

Gemini Image Generation via `google-genai` Python SDK.

## Setup

```bash
pip install google-genai pillow
export GEMINI_API_KEY="your-key"
```

## Models

| Model | Alias | Resolution | Use Case |
|-------|-------|------------|----------|
| `gemini-2.5-flash-image` | Nano Banana | 1024px | Fast, high-volume |
| `gemini-3-pro-image-preview` | Nano Banana Pro | Up to 4K | Pro assets, text rendering |

## Core Pattern

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="...")

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["prompt"],
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",  # 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
            image_size="2K"       # 1K, 2K, 4K (4K = Pro only)
        )
    )
)
```

## Response Handling

```python
for part in response.parts:
    if part.text:
        print(part.text)              # Text token
    elif part.inline_data:
        img = part.as_image()         # PIL Image (image chunk)
        img.save("output.png")
```

### Raw Base64 Access

```python
if part.inline_data:
    mime = part.inline_data.mime_type   # "image/png"
    data = part.inline_data.data        # Base64 string
```

## Operations

### 1. Text-to-Image

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["A cat wearing a wizard hat"],
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)
```

### 2. Edit Image

```python
from PIL import Image

img = Image.open("input.png")
response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=["Add a rainbow to the sky", img],  # instruction + image
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)
```

### 3. Compose Multiple Images (up to 14)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "Create group photo of these people",
        Image.open("person1.png"),
        Image.open("person2.png"),
        Image.open("person3.png"),
    ],
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)
```

### 4. Multi-Turn Chat (Iterative Refinement)

```python
chat = client.chats.create(
    model="gemini-2.5-flash-image",
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
)

# First turn
r1 = chat.send_message("Create a logo for 'Acme Corp'")

# Refine
r2 = chat.send_message("Make text bolder, add blue gradient")

# Include image in chat
r3 = chat.send_message([Image.open("ref.png"), "Apply this style"])
```

### 5. Google Search Grounding (Pro Only)

```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Visualize today's Tokyo weather as infographic"],
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        tools=[{"google_search": {}}]
    )
)
```

## REST API (curl)

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "A mountain landscape"}]}],
    "generationConfig": {
      "responseModalities": ["TEXT", "IMAGE"]
    }
  }' | jq -r '.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data' | base64 -d > out.png
```

## Quick Reference Class

```python
class GeminiImageGenerator:
    FLASH = "gemini-2.5-flash-image"
    PRO = "gemini-3-pro-image-preview"

    def __init__(self, api_key=None, model=FLASH):
        self.client = genai.Client(api_key=api_key or os.environ["GEMINI_API_KEY"])
        self.model = model

    def generate(self, prompt, output, **opts) -> tuple[Path, str|None]:
        """Text-to-image. Returns (path, text_response)"""

    def edit(self, input_img, instruction, output, **opts) -> tuple[Path, str|None]:
        """Edit existing image"""

    def compose(self, instruction, images, output, **opts) -> tuple[Path, str|None]:
        """Combine up to 14 images"""

    def chat(self) -> ImageChat:
        """Start multi-turn session"""
```

## CLI Scripts

```bash
# Generate
python generate_image.py "A sunset" out.png --aspect 16:9 --size 2K

# Edit
python edit_image.py input.png "Add clouds" output.png

# Compose
python compose_images.py "Group photo" group.png p1.png p2.png p3.png

# Interactive chat
python multi_turn_chat.py --model gemini-3-pro-image-preview
```

## Notes

- All images include SynthID watermarks
- Image-only mode (`["IMAGE"]`) incompatible with Google Search
- Model handles semantic masking automatically for edits
