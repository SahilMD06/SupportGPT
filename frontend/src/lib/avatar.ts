// Preset avatars — simple flat-style silhouette icons (hand-authored SVG,
// no external images/fonts), stored in the existing `profile_picture` string
// field using the convention "avatar:{style}:{hex}" (e.g. "avatar:a:0EA5E9").
// A normal http(s):// value in the same field is still rendered as a real
// image — see Avatar.tsx.

export interface AvatarPreset {
  id: string;    // "a-0" .. "a-4", "b-0" .. "b-4"
  style: 'a' | 'b';
  hex: string;
  label: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'a-0', style: 'a', hex: '0EA5E9', label: 'Sky' },
  { id: 'a-1', style: 'a', hex: '8B5CF6', label: 'Violet' },
  { id: 'a-2', style: 'a', hex: 'EC4899', label: 'Pink' },
  { id: 'a-3', style: 'a', hex: 'F97316', label: 'Orange' },
  { id: 'a-4', style: 'a', hex: '10B981', label: 'Green' },
  { id: 'b-0', style: 'b', hex: '6366F1', label: 'Indigo' },
  { id: 'b-1', style: 'b', hex: 'F43F5E', label: 'Rose' },
  { id: 'b-2', style: 'b', hex: '14B8A6', label: 'Teal' },
  { id: 'b-3', style: 'b', hex: 'F59E0B', label: 'Amber' },
  { id: 'b-4', style: 'b', hex: '64748B', label: 'Slate' },
];

export function presetAvatarValue(preset: AvatarPreset): string {
  return `avatar:${preset.style}:${preset.hex}`;
}

export function isPresetAvatar(value?: string | null): boolean {
  return !!value && value.startsWith('avatar:');
}

export function parsePresetAvatar(value?: string | null): { style: 'a' | 'b'; hex: string } | null {
  if (!value || !value.startsWith('avatar:')) return null;
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  const [, style, hex] = parts;
  if ((style !== 'a' && style !== 'b') || !/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return { style, hex };
}

// Hand-authored flat silhouette paths (40x40 viewBox), verified by rendering
// before being wired in — see the two styles below.
export const AVATAR_SILHOUETTE_PATHS: Record<'a' | 'b', string[]> = {
  a: [
    'M20 8 C25.5 8 29 11.8 29 16.5 L29 18 C26.5 15.5 23.5 14.5 20 14.5 C16.5 14.5 13.5 15.5 11 18 L11 16.5 C11 11.8 14.5 8 20 8 Z',
    'M6 40 C6 31.5 12.3 26 20 26 C27.7 26 34 31.5 34 40 Z',
  ],
  b: [
    'M20 7 C26 7 30 12 30 18 C30 22 29 27 27.5 30 C28 26 27.5 22 25 20.5 C25.8 19 26 17 25 15.5 C23.5 17.5 21.5 18.5 20 18.5 C18.5 18.5 16.5 17.5 15 15.5 C14 17 14.2 19 15 20.5 C12.5 22 12 26 12.5 30 C11 27 10 22 10 18 C10 12 14 7 20 7 Z',
    'M7 40 C7 31.5 13 26 20 26 C27 26 33 31.5 33 40 Z',
  ],
};

// Head circle is the same for both styles
export const AVATAR_HEAD = { cx: 20, cy: 18, r: 6.5 };
