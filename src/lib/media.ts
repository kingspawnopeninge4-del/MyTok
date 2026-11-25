import { File } from 'expo-file-system';

// Reads a local file into memory so it can be uploaded
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  try {
    return await new File(uri).arrayBuffer();
  } catch {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  }
}

export function getExt(uri: string): string {
  const clean = uri.split('?')[0];
  const dot = clean.lastIndexOf('.');
  const raw = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
  return ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(raw) ? raw : 'mp4';
}

export function mimeFor(ext: string): string {
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  if (ext === 'webm') return 'video/webm';
  if (ext === '3gp') return 'video/3gpp';
  return 'video/mp4';
}
export function getImageExt(uri: string): string {
  const clean = uri.split('?')[0];
  const dot = clean.lastIndexOf('.');
  const raw = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(raw) ? raw : 'jpg';
}

export function imageMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}