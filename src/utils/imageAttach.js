// READING A PICTURE INTO A MESSAGE. One place, because three doorways lead here — paste, drop,
// and the file picker — and three copies of "turn a File into base64" is three places for the
// mime type to be guessed differently.
//
// TWO PRODUCTS FROM ONE READ:
//   data  — the bytes that go to the model, base64 WITHOUT the `data:` prefix (the API takes raw)
//   thumb — a small data URL the feed keeps forever, so the record can show what you sent without
//           carrying megabytes of screenshot in an in-memory event list
//
// ORIGINAL BYTES BY DEFAULT. A screenshot is mostly small text, and re-encoding it to JPEG to save
// a little size is how the thing you are pointing at becomes unreadable. Only a genuinely large
// file is downscaled, and then only to the longest edge the model actually uses.
const MAX_EDGE = 1568; // Anthropic's effective ceiling — above this the image is resized anyway
const REENCODE_OVER = 4 * 1024 * 1024;
const THUMB_EDGE = 320;

export const isImageFile = (f) => !!f && /^image\//.test(f.type || "");

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("could not read the file"));
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not decode the image"));
    img.src = src;
  });

// Draw to a canvas bounded by `edge` and return a data URL. Returns "" if anything goes wrong —
// a missing thumbnail costs a grey chip, never the send.
async function scaled(dataUrl, edge, mime) {
  try {
    const img = await loadImage(dataUrl);
    const big = Math.max(img.width, img.height) || 1;
    const k = Math.min(1, edge / big);
    const w = Math.max(1, Math.round(img.width * k));
    const h = Math.max(1, Math.round(img.height * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    // PNG for thumbs of PNGs so screenshot text stays legible in the record; JPEG otherwise.
    return c.toDataURL(mime === "image/png" ? "image/png" : "image/jpeg", 0.86);
  } catch {
    return "";
  }
}

const stripPrefix = (dataUrl) => String(dataUrl).replace(/^data:[^;]+;base64,/, "");

// -> { id, name, mime, data, thumb } | null
export async function readImageFile(file) {
  if (!isImageFile(file)) return null;
  const mime = file.type || "image/png";
  const original = await readAsDataUrl(file);
  let data = stripPrefix(original);
  let sendMime = mime;
  if (file.size > REENCODE_OVER) {
    const small = await scaled(original, MAX_EDGE, "image/jpeg");
    if (small) {
      data = stripPrefix(small);
      sendMime = "image/jpeg";
    }
  }
  const thumb = (await scaled(original, THUMB_EDGE, mime)) || original;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "pasted image",
    mime: sendMime,
    data,
    thumb,
  };
}

// Every image in a paste or a drop, in order, skipping whatever isn't one.
export async function readImagesFrom(dataTransfer) {
  if (!dataTransfer) return [];
  const files = [];
  if (dataTransfer.files && dataTransfer.files.length) files.push(...dataTransfer.files);
  else if (dataTransfer.items) {
    for (const it of dataTransfer.items) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
  }
  const out = [];
  for (const f of files.filter(isImageFile)) {
    try {
      const im = await readImageFile(f);
      if (im) out.push(im);
    } catch {}
  }
  return out;
}

export const hasImages = (dataTransfer) => {
  if (!dataTransfer) return false;
  const types = [...(dataTransfer.types || [])];
  if (types.includes("Files")) return true;
  return [...(dataTransfer.items || [])].some((i) => i.kind === "file" && /^image\//.test(i.type || ""));
};
