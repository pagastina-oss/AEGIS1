import { supabase } from '../supabase';
import type { FairnessResult } from '../types';

const URGENCY_KEYWORDS = ['only', 'left', 'limited', 'expires', 'today only', 'last chance', 'ending soon'];
const PRESSURE_KEYWORDS = ['buy now', 'act now', 'dont wait', 'hurry', 'before its gone', 'final hours', 'going fast'];
const CONFUSION_KEYWORDS = ['bundled', 'auto-renew', 'subscription', 'terms apply', 'conditions', 'subject to', 'may vary'];

function scoreKeywords(text: string, keywords: string[]): { score: number; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw)) matched.push(kw);
  }
  const score = Math.min(100, matched.length * 20);
  return { score, matched };
}

export async function analyzeFairness(conversationText: string): Promise<FairnessResult> {
  const urgency = scoreKeywords(conversationText, URGENCY_KEYWORDS);
  const pressure = scoreKeywords(conversationText, PRESSURE_KEYWORDS);
  const confusion = scoreKeywords(conversationText, CONFUSION_KEYWORDS);

  const totalScore = urgency.score + pressure.score + confusion.score;
  const autoEscalate = totalScore > 200;
  const allMatches = [...urgency.matched, ...pressure.matched, ...confusion.matched];

  const verdict = autoEscalate ? 'FAIRNESS_WARNING' : 'FAIR';

  const { data: action } = await supabase
    .from('agent_actions')
    .insert({
      agent_id: 'A4',
      user_id: 'U001',
      action_type: 'FAIRNESS_CHECK',
      verification_status: autoEscalate ? 'ESCALATED' : 'VERIFIED',
    })
    .select()
    .single();

  if (action) {
    await supabase.from('fairness_scores').insert({
      agent_action_id: action.id,
      urgency_score: urgency.score,
      pressure_score: pressure.score,
      confusion_score: confusion.score,
      total_score: totalScore,
      auto_escalate: autoEscalate,
      keyword_matches: allMatches,
    });
  }

  return {
    urgency_score: urgency.score,
    pressure_score: pressure.score,
    confusion_score: confusion.score,
    total_score: totalScore,
    auto_escalate: autoEscalate,
    keyword_matches: allMatches,
    verdict,
  };
}
