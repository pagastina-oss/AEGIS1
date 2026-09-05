import { supabase } from '../supabase';
import type { ConsentResult } from '../types';

function simplifyTerms(original: string): string {
  const simplified = original
    .replace(/hereby|herein|hereunder|heretofore|aforementioned/gi, '')
    .replace(/shall not be liable/gi, 'is not responsible for')
    .replace(/shall be liable/gi, 'is responsible for')
    .replace(/pursuant to/gi, 'under')
    .replace(/in accordance with/gi, 'following')
    .replace(/notwithstanding/gi, 'even so')
    .replace(/indemnify and hold harmless/gi, 'protect')
    .replace(/binding arbitration/gi, 'a decision by AEGIS')
    .replace(/dynamic pricing algorithms/gi, 'changing prices')
    .replace(/acknowledge and agree/gi, 'agree')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = simplified.split(/(?<=[.])\s+/).filter((s) => s.trim().length > 0);
  const bulletized = sentences
    .map((s, i) => `${i + 1}) ${s.trim()}`)
    .join('\n');

  return bulletized || simplified;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function simplifyAndLog(
  userId: string,
  originalTerms: string,
  userAcknowledged: boolean
): Promise<ConsentResult> {
  const simplified = simplifyTerms(originalTerms);
  const hash = await sha256(`${userId}:${simplified}:${Date.now()}`);

  const { error } = await supabase.from('consent_logs').insert({
    user_id: userId,
    original_terms: originalTerms,
    simplified_terms: simplified,
    user_acknowledged: userAcknowledged,
    hash,
  });

  if (error) throw error;

  const verdict = userAcknowledged ? 'CONSENT_LOGGED' : 'CONSENT_PENDING';

  return {
    simplified_terms: simplified,
    hash,
    user_acknowledged: userAcknowledged,
    verdict,
  };
}
