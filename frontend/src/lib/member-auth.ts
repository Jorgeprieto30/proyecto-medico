const TOKEN_KEY = 'member_token';
const PROFILE_KEY = 'member_profile';

// Only non-sensitive display fields are stored in localStorage.
// PII like rut and birth_date must be fetched from the API when needed.
export interface MemberProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function memberLogin(token: string, profile: { id: string; first_name: string; last_name: string; email: string; [key: string]: unknown }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  // Store only non-sensitive fields
  const { id, first_name, last_name, email } = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ id, first_name, last_name, email }));
}

export function memberLogout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function getMemberToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getMemberProfile(): MemberProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MemberProfile;
  } catch {
    return null;
  }
}

export function updateMemberProfile(profile: { id: string; first_name: string; last_name: string; email: string; [key: string]: unknown }): void {
  if (typeof window === 'undefined') return;
  // Store only non-sensitive fields
  const { id, first_name, last_name, email } = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ id, first_name, last_name, email }));
}

export function isMemberLoggedIn(): boolean {
  return !!getMemberToken();
}
