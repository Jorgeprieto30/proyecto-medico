const TOKEN_KEY = 'member_token';
const PROFILE_KEY = 'member_profile';

export interface MemberProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  rut: string | null;
}

export function memberLogin(token: string, profile: MemberProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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

export function isMemberLoggedIn(): boolean {
  return !!getMemberToken();
}
