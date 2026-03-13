#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────
# docx-to-mdx.sh — Convert .docx files to structured .mdx content
#
# Usage:
#   ./scripts/docx-to-mdx.sh <input.docx> [--type faq|syllabus] [--topic agriculture|education|...]
#
# The script auto-detects the type and topic from the filename if it
# follows the convention:
#   Doc_LibertyLighthouse_FAQ_Agriculture.docx
#   Doc_LibertyLighthouse_GuidedCurriculum_Education.docx
#
# Output:
#   FAQ docs     → src/content/faqs/{topic}/*.mdx   (one file per question)
#   Syllabus docs → src/content/syllabus/{topic}/*.mdx (one file per doc)
#
# Images are extracted to public/images/content/{topic}/ at full quality.
#
# Requirements: pandoc (brew install pandoc)
# ───────────────────────────────────────────────────────────────────────
set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- Helpers ---
log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1" >&2; exit 1; }
info()  { echo -e "${BLUE}[·]${NC} $1"; }

# --- Find project root (look for package.json) ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
  error "Cannot find project root (no package.json). Run from the project directory."
fi

# --- Check dependencies ---
if ! command -v pandoc &>/dev/null; then
  error "pandoc is required. Install with: brew install pandoc"
fi

# --- Parse arguments ---
INPUT_FILE=""
TYPE=""
TOPIC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)   TYPE="$2"; shift 2 ;;
    --topic)  TOPIC="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 <input.docx> [--type faq|syllabus] [--topic name]"
      echo ""
      echo "Converts .docx files to .mdx content for Liberty Lighthouse."
      echo ""
      echo "Options:"
      echo "  --type     faq or syllabus (auto-detected from filename)"
      echo "  --topic    Topic slug like 'agriculture' or 'education' (auto-detected)"
      echo ""
      echo "Filename convention for auto-detection:"
      echo "  Doc_LibertyLighthouse_FAQ_Agriculture.docx"
      echo "  Doc_LibertyLighthouse_GuidedCurriculum_Education.docx"
      exit 0
      ;;
    *)
      if [[ -z "$INPUT_FILE" ]]; then
        INPUT_FILE="$1"
      else
        error "Unknown argument: $1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$INPUT_FILE" ]]; then
  error "No input file specified. Usage: $0 <input.docx>"
fi

if [[ ! -f "$INPUT_FILE" ]]; then
  error "File not found: $INPUT_FILE"
fi

BASENAME="$(basename "$INPUT_FILE" .docx)"

# --- Auto-detect type and topic from filename ---
if [[ -z "$TYPE" ]]; then
  if [[ "$BASENAME" == *"FAQ"* ]]; then
    TYPE="faq"
  elif [[ "$BASENAME" == *"GuidedCurriculum"* || "$BASENAME" == *"Syllabus"* ]]; then
    TYPE="syllabus"
  else
    error "Cannot detect content type from filename '$BASENAME'. Use --type faq|syllabus"
  fi
  info "Auto-detected type: $TYPE"
fi

if [[ -z "$TOPIC" ]]; then
  # Extract last segment after the last underscore
  TOPIC="$(echo "$BASENAME" | rev | cut -d'_' -f1 | rev | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$TOPIC" ]]; then
    error "Cannot detect topic from filename. Use --topic <name>"
  fi
  info "Auto-detected topic: $TOPIC"
fi

# --- Setup directories ---
CONTENT_DIR="$PROJECT_ROOT/src/content"
IMAGE_DIR="$PROJECT_ROOT/public/images/content/$TOPIC"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

mkdir -p "$IMAGE_DIR"

# --- Extract markdown + images via pandoc ---
info "Converting $BASENAME.docx with pandoc..."
MARKDOWN_FILE="$TEMP_DIR/output.md"
pandoc "$INPUT_FILE" \
  -t markdown \
  --wrap=none \
  --extract-media="$TEMP_DIR/media" \
  -o "$MARKDOWN_FILE"

log "Pandoc conversion complete"

# --- Copy extracted images to public dir ---
IMAGE_COUNT=0
if [[ -d "$TEMP_DIR/media" ]]; then
  find "$TEMP_DIR/media" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" \) | while read -r img; do
    IMGNAME="$(basename "$img")"
    cp "$img" "$IMAGE_DIR/$IMGNAME"
    ((IMAGE_COUNT++)) || true
  done
  IMAGE_COUNT=$(find "$TEMP_DIR/media" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" \) | wc -l | tr -d ' ')
  log "Extracted $IMAGE_COUNT image(s) to public/images/content/$TOPIC/"
fi

# --- Slugify function ---
slugify() {
  echo "$1" \
    | sed 's/[^a-zA-Z0-9 ]//g' \
    | tr '[:upper:]' '[:lower:]' \
    | tr ' ' '-' \
    | sed 's/--*/-/g' \
    | sed 's/^-//;s/-$//' \
    | cut -c1-60
}

# --- Today's date ---
TODAY="$(date +%Y-%m-%d)"

# =====================================================================
# FAQ Processing
# =====================================================================
if [[ "$TYPE" == "faq" ]]; then
  FAQ_DIR="$CONTENT_DIR/faqs/$TOPIC"
  mkdir -p "$FAQ_DIR"

  info "Splitting FAQ into individual .mdx files..."

  # Use Python for reliable markdown splitting
  python3 << 'PYEOF' - "$MARKDOWN_FILE" "$FAQ_DIR" "$TOPIC" "$TODAY" "$IMAGE_DIR" "$TEMP_DIR/media"
import sys, re, os

md_file = sys.argv[1]
out_dir = sys.argv[2]
topic = sys.argv[3]
today = sys.argv[4]
image_dir = sys.argv[5]
media_dir = sys.argv[6]

with open(md_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Split on H2 headings (## Question text)
sections = re.split(r'^## ', content, flags=re.MULTILINE)

# First section is the H1 title / preamble — skip it
if len(sections) < 2:
    print(f"[!] No H2 headings found in the document", file=sys.stderr)
    sys.exit(1)

def slugify(text):
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    text = text.lower().strip()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:60].rstrip('-')

def fix_image_paths(body, topic, media_dir):
    """Replace pandoc media paths with public image paths."""
    def replace_img(m):
        alt = m.group(1)
        old_path = m.group(2)
        # Extract just the filename
        img_name = os.path.basename(old_path)
        new_path = f'/images/content/{topic}/{img_name}'
        return f'![{alt}]({new_path})'

    # Match ![alt](path){optional_attrs}
    body = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)(\{[^}]*\})?', replace_img, body)
    return body

def clean_body(body):
    """Clean up pandoc artifacts."""
    # Remove {.underline} and similar attributes
    body = re.sub(r'\{\.underline\}', '', body)
    # Remove width/height attributes from images
    body = re.sub(r'\{width="[^"]*"\s*height="[^"]*"\}', '', body)
    # Remove standalone backslashes (line continuation artifacts)
    body = re.sub(r'\\\n', '\n', body)
    # Remove leading > from blockquotes (the docx uses them as regular paragraphs)
    lines = body.split('\n')
    cleaned = []
    for line in lines:
        if line.startswith('> '):
            cleaned.append(line[2:])
        elif line == '>':
            cleaned.append('')
        else:
            cleaned.append(line)
    body = '\n'.join(cleaned)
    # Collapse 3+ blank lines into 2
    body = re.sub(r'\n{3,}', '\n\n', body)
    return body.strip()

# Find existing files and their max order to append, not override
existing_slugs = set()
max_order = 0
for fname in os.listdir(out_dir):
    if fname.endswith('.mdx'):
        existing_slugs.add(fname[:-4])  # strip .mdx
        fpath = os.path.join(out_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as ef:
            for line in ef:
                m = re.match(r'^order:\s*(\d+)', line)
                if m:
                    max_order = max(max_order, int(m.group(1)))
                    break

added = 0
skipped = 0
updated = 0
order_offset = max_order

for i, section in enumerate(sections[1:], 1):
    lines = section.split('\n', 1)
    question = lines[0].strip().rstrip('?').strip() + '?'
    # Remove any bold markers from question
    question = question.replace('**', '')
    body = lines[1] if len(lines) > 1 else ''

    body = fix_image_paths(body, topic, media_dir)
    body = clean_body(body)

    slug = slugify(question)
    if not slug:
        slug = f'question-{i}'

    filepath = os.path.join(out_dir, f'{slug}.mdx')

    if slug in existing_slugs:
        # Same question exists — update its content but keep its order
        with open(filepath, 'r', encoding='utf-8') as ef:
            old_content = ef.read()
        old_order_match = re.search(r'^order:\s*(\d+)', old_content, re.MULTILINE)
        existing_order = int(old_order_match.group(1)) if old_order_match else i

        safe_question = question.replace('"', '\\"')
        frontmatter = f'''---
question: "{safe_question}"
topic: "{topic}"
order: {existing_order}
draft: false
updatedAt: "{today}"
---'''
        mdx_content = f'{frontmatter}\n\n{body}\n'
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(mdx_content)
        updated += 1
        print(f'  ↻ {slug}.mdx (updated)')
    else:
        # New question — assign next order number
        order_offset += 1
        safe_question = question.replace('"', '\\"')
        frontmatter = f'''---
question: "{safe_question}"
topic: "{topic}"
order: {order_offset}
draft: false
updatedAt: "{today}"
---'''
        mdx_content = f'{frontmatter}\n\n{body}\n'
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(mdx_content)
        added += 1
        print(f'  → {slug}.mdx (new, order {order_offset})')

parts = []
if added: parts.append(f'{added} added')
if updated: parts.append(f'{updated} updated')
if skipped: parts.append(f'{skipped} skipped')
print(f'\n[✓] {", ".join(parts)} in {out_dir}')
PYEOF

# =====================================================================
# Syllabus Processing
# =====================================================================
elif [[ "$TYPE" == "syllabus" ]]; then
  SYLLABUS_DIR="$CONTENT_DIR/syllabus/$TOPIC"
  mkdir -p "$SYLLABUS_DIR"

  info "Processing syllabus document..."

  python3 << 'PYEOF' - "$MARKDOWN_FILE" "$SYLLABUS_DIR" "$TOPIC" "$TODAY" "$IMAGE_DIR" "$TEMP_DIR/media"
import sys, re, os

md_file = sys.argv[1]
out_dir = sys.argv[2]
topic = sys.argv[3]
today = sys.argv[4]
image_dir = sys.argv[5]
media_dir = sys.argv[6]

with open(md_file, 'r', encoding='utf-8') as f:
    content = f.read()

def slugify(text):
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    text = text.lower().strip()
    text = re.sub(r'\s+', '-', text)
    return text[:60].rstrip('-')

def clean_body(body):
    body = re.sub(r'\{\.underline\}', '', body)
    body = re.sub(r'\{width="[^"]*"\s*height="[^"]*"\}', '', body)
    body = re.sub(r'\\\n', '\n', body)
    def replace_img(m):
        alt = m.group(1)
        old_path = m.group(2)
        img_name = os.path.basename(old_path)
        new_path = f'/images/content/{topic}/{img_name}'
        return f'![{alt}]({new_path})'
    body = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)(\{[^}]*\})?', replace_img, body)
    body = re.sub(r'\n{3,}', '\n\n', body)
    return body.strip()

# Split on H2 headings — each becomes its own syllabus page
sections = re.split(r'^## ', content, flags=re.MULTILINE)

if len(sections) < 2:
    print('[!] No H2 headings found — creating single file', file=sys.stderr)
    # Fallback: single file
    h1_match = re.match(r'^#\s+(.+?)$', content, re.MULTILINE)
    title = h1_match.group(1).strip().replace('**', '') if h1_match else topic.title() + ' Guided Curriculum'
    body = re.sub(r'^#\s+.+?\n', '', content, count=1)
    body = clean_body(body)
    slug = slugify(title)
    safe_title = title.replace('"', '\\"')
    mdx = f'---\ntitle: "{safe_title}"\ntopic: "{topic}"\nmoduleNumber: 1\ndescription: "Curated reading list and resources for {topic}."\ndraft: false\nupdatedAt: "{today}"\n---\n\n{body}\n'
    with open(os.path.join(out_dir, f'{slug}.mdx'), 'w') as f:
        f.write(mdx)
    print(f'  → {slug}.mdx')
    print(f'\n[✓] Created 1 syllabus file in {out_dir}')
    sys.exit(0)

# Clear existing syllabus files for this topic (syllabus = full override)
for fname in os.listdir(out_dir):
    if fname.endswith('.mdx'):
        os.remove(os.path.join(out_dir, fname))

count = 0
for i, section in enumerate(sections[1:], 1):
    lines = section.split('\n', 1)
    section_title = lines[0].strip().replace('**', '')
    body = lines[1] if len(lines) > 1 else ''
    body = clean_body(body)

    slug = slugify(section_title)
    if not slug:
        slug = f'module-{i}'

    safe_title = section_title.replace('"', '\\"')

    frontmatter = f'''---
title: "{safe_title}"
topic: "{topic}"
moduleNumber: {i}
description: "Curated {section_title.lower()} for {topic}."
draft: false
updatedAt: "{today}"
---'''

    mdx_content = f'{frontmatter}\n\n{body}\n'

    filepath = os.path.join(out_dir, f'{slug}.mdx')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(mdx_content)
    count += 1
    print(f'  → {slug}.mdx (module {i})')

print(f'\n[✓] Created {count} syllabus files in {out_dir}')
PYEOF

else
  error "Unknown type: $TYPE. Use --type faq|syllabus"
fi

echo ""
log "Done! Converted $BASENAME.docx → src/content/"
