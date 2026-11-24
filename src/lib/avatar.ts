import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

// Uploads a profile picture and returns its public URL (or null if it failed)
export async function uploadAvatar(
  userId: string,
  base64: string
): Promise<string | null> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) {
    return null;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}