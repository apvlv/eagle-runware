export type EagleItemRef = EagleItem;
export type EagleFolderRef = EagleFolder;

export interface FlatFolder {
  id: string;
  name: string;
  path: string;
  depth: number;
  raw: EagleFolder;
}

export interface SavableGenerated {
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  outputFormat?: string;
}

export interface SaveGeneratedOptions {
  name?: string;
  tags?: string[];
  folderId?: string | null;
  annotation?: string;
}

const MAX_DATA_URI_BYTES = 20 * 1024 * 1024;

function requireEagle(): EagleAPI {
  if (typeof eagle === 'undefined' || !eagle) {
    throw new Error('Eagle API is not available — this code must run inside an Eagle plugin window.');
  }
  return eagle;
}

type NodeFsModule = {
  readFileSync: (path: string) => Uint8Array;
  statSync: (path: string) => { size: number };
};

let _fsCache: NodeFsModule | null | undefined;
function loadFs(): NodeFsModule | null {
  if (_fsCache !== undefined) return _fsCache;
  try {
    const req = (globalThis as unknown as { require?: (mod: string) => unknown }).require;
    if (typeof req === 'function') {
      _fsCache = req('fs') as NodeFsModule;
      return _fsCache;
    }
  } catch (err) {
    console.warn('[Runware] node fs unavailable:', err);
  }
  _fsCache = null;
  return null;
}

function normalizeExtToMime(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '');
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'svg') return 'image/svg+xml';
  return `image/${e}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function inferExtFromFormat(format: string | undefined): string {
  const f = (format ?? 'PNG').toLowerCase();
  if (f === 'jpg' || f === 'jpeg') return 'jpg';
  if (f === 'webp') return 'webp';
  return 'png';
}

export async function getSelectedItems(): Promise<EagleItem[]> {
  const api = requireEagle();
  if (!api.item?.getSelected) return [];
  const result = await api.item.getSelected();
  return Array.isArray(result) ? result : [];
}

export async function getSelectedFolder(): Promise<EagleFolder | null> {
  const api = requireEagle();
  if (!api.folder?.getSelected) return null;
  const folders = await api.folder.getSelected();
  return Array.isArray(folders) && folders.length > 0 ? folders[0] : null;
}

export async function listAllFolders(): Promise<FlatFolder[]> {
  const api = requireEagle();
  if (!api.folder?.getAll) return [];
  const roots = await api.folder.getAll();
  const out: FlatFolder[] = [];
  const walk = (node: EagleFolder, trail: string[], depth: number): void => {
    const path = [...trail, node.name].join(' / ');
    out.push({ id: node.id, name: node.name, path, depth, raw: node });
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) walk(child, [...trail, node.name], depth + 1);
  };
  for (const root of roots) walk(root, [], 0);
  return out;
}

export interface ItemToDataURIResult {
  dataURI: string;
  bytes: number;
  mime: string;
}

export function itemToDataURI(item: EagleItem): ItemToDataURIResult {
  const fs = loadFs();
  if (!fs) {
    throw new Error('Node fs is not available — cannot read item file.');
  }
  if (!item.filePath) {
    throw new Error(`Item ${item.id} has no filePath.`);
  }
  const { size } = fs.statSync(item.filePath);
  if (size > MAX_DATA_URI_BYTES) {
    throw new Error(
      `Item ${item.id} is too large for a data URI (${size} bytes > ${MAX_DATA_URI_BYTES}). ` +
        'Pass the file path directly to the Runware upload helper instead.',
    );
  }
  const bytes = fs.readFileSync(item.filePath);
  const mime = normalizeExtToMime(item.ext);
  const base64 = bytesToBase64(bytes);
  return { dataURI: `data:${mime};base64,${base64}`, bytes: size, mime };
}

export function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('FileReader returned a non-string result.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'));
    reader.readAsDataURL(file);
  });
}

export async function urlToDataURI(url: string): Promise<{ dataURI: string; bytes: number }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status} ${res.statusText}).`);
  }
  const blob = await res.blob();
  const file = new File([blob], 'reference', { type: blob.type || 'image/png' });
  const dataURI = await fileToDataURI(file);
  return { dataURI, bytes: blob.size };
}

export async function saveGeneratedToLibrary(
  generated: SavableGenerated,
  opts: SaveGeneratedOptions = {},
): Promise<string> {
  const api = requireEagle();
  if (!api.item?.addFromURL || !api.item.addFromBase64) {
    throw new Error('Eagle item API is not available.');
  }

  const name = opts.name ?? `Runware ${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const folders = opts.folderId ? [opts.folderId] : [];
  const baseOptions: EagleAddFromURLOptions = {
    name,
    website: 'https://runware.ai',
    tags: opts.tags,
    folders,
    annotation: opts.annotation,
  };

  if (generated.imageURL) {
    return api.item.addFromURL(generated.imageURL, baseOptions);
  }

  const base64 =
    generated.imageBase64Data ??
    (generated.imageDataURI ? generated.imageDataURI.replace(/^data:[^;]+;base64,/, '') : undefined);

  if (!base64) {
    throw new Error('Generated payload has neither imageURL nor base64 data.');
  }

  const ext = inferExtFromFormat(generated.outputFormat);
  return api.item.addFromBase64(base64, { ...baseOptions, ext });
}

async function getItemByIdStrict(itemId: string): Promise<EagleItem> {
  const api = requireEagle();
  if (!api.item?.getById) {
    throw new Error('Eagle item.getById is not available.');
  }
  const item = await api.item.getById(itemId);
  if (!item) throw new Error(`Eagle item ${itemId} not found.`);
  return item;
}

export async function setItemStar(itemId: string, star: number): Promise<void> {
  const item = await getItemByIdStrict(itemId);
  item.star = star;
  if (typeof item.save !== 'function') {
    throw new Error(`Eagle item ${itemId} cannot be saved (no save() method).`);
  }
  await item.save();
}

export async function updateItemTags(itemId: string, tags: string[]): Promise<void> {
  const item = await getItemByIdStrict(itemId);
  item.tags = [...tags];
  if (typeof item.save !== 'function') {
    throw new Error(`Eagle item ${itemId} cannot be saved (no save() method).`);
  }
  await item.save();
}

export async function appendAnnotation(itemId: string, text: string): Promise<void> {
  const item = await getItemByIdStrict(itemId);
  const prev = typeof item.annotation === 'string' ? item.annotation : '';
  item.annotation = prev ? `${prev}\n${text}` : text;
  if (typeof item.save !== 'function') {
    throw new Error(`Eagle item ${itemId} cannot be saved (no save() method).`);
  }
  await item.save();
}

type LibraryChangedListener = (libraryPath: string) => void;
const libraryListeners = new Set<LibraryChangedListener>();
let librarySubscribed = false;

function ensureLibrarySubscription(): void {
  if (librarySubscribed) return;
  if (typeof eagle === 'undefined' || !eagle?.onLibraryChanged) return;
  eagle.onLibraryChanged((libraryPath: string) => {
    for (const l of libraryListeners) {
      try {
        l(libraryPath);
      } catch (err) {
        console.warn('[Runware] library listener threw:', err);
      }
    }
  });
  librarySubscribed = true;
}

export function onLibraryChanged(listener: LibraryChangedListener): () => void {
  ensureLibrarySubscription();
  libraryListeners.add(listener);
  return () => {
    libraryListeners.delete(listener);
  };
}
