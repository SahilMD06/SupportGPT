import { parsePresetAvatar, AVATAR_SILHOUETTE_PATHS, AVATAR_HEAD } from '@/lib/avatar';

interface AvatarProps {
  profilePicture?: string | null;
  name?: string;
  className?: string;      // controls size, e.g. "w-7 h-7"
  textClassName?: string;  // controls fallback-initial font size, e.g. "text-xs"
}

/**
 * Renders a user's avatar from the single `profile_picture` string field:
 * - "avatar:{a|b}:{hex}" -> a preset silhouette icon on a colored background
 * - "https://..."        -> an actual <img>, falling back to the initial if it fails to load
 * - empty/null           -> the default brand-colored initial circle
 *
 * Used in both AppLayout (sidebar) and Settings (profile preview) so the two
 * never fall out of sync with each other.
 */
export function Avatar({
  profilePicture,
  name,
  className = 'w-7 h-7',
  textClassName = 'text-xs',
}: AvatarProps) {
  const initial = name?.[0]?.toUpperCase() || '?';
  const preset = parsePresetAvatar(profilePicture);

  if (preset) {
    const paths = AVATAR_SILHOUETTE_PATHS[preset.style];
    return (
      <div className={`${className} rounded-full flex-shrink-0 overflow-hidden`}>
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect width="40" height="40" fill={`#${preset.hex}`} />
          {paths.map((d, i) => (
            <path key={i} d={d} fill="white" fillOpacity="0.95" />
          ))}
          <circle cx={AVATAR_HEAD.cx} cy={AVATAR_HEAD.cy} r={AVATAR_HEAD.r} fill="white" fillOpacity="0.95" />
        </svg>
      </div>
    );
  }

  if (profilePicture) {
    return (
      <div className={`${className} rounded-full flex-shrink-0 overflow-hidden`} style={{ background: 'var(--accent-600)' }}>
        <img
          src={profilePicture}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            // Broken/unreachable URL — fall back to showing the initial instead
            // of a broken image icon.
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            if (target.parentElement && !target.parentElement.querySelector('.avatar-fallback')) {
              const span = document.createElement('span');
              span.className = `avatar-fallback text-white font-semibold ${textClassName}`;
              span.textContent = initial;
              target.parentElement.appendChild(span);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${textClassName}`}
      style={{ background: 'var(--accent-600)' }}
    >
      {initial}
    </div>
  );
}
