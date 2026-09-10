import type { FormIcon } from './forms';

export interface FaqQuestion {
  q: string;
  a: string;
  button?: { label: string; url: string };
}

/**
 * Een set veelgestelde vragen als kanaal. De bezoeker kiest een vraag, krijgt
 * het antwoord in het gesprek, en kan daarna doorlopen naar de kanalen uit
 * `followUp` — dat zijn gewone kanaal-id's, dus die meten als zichzelf.
 */
export interface FaqDef {
  id: string;
  title: string;
  sub: string;
  icon: FormIcon;
  intro: string;
  questions: FaqQuestion[];
  followUp: string[];
}

export interface UserFaqQuestion {
  q?: string;
  a?: string;
  button?: { label?: string; url?: string };
}

export interface UserFaqDef {
  title?: string;
  sub?: string;
  icon?: FormIcon;
  intro?: string;
  questions?: UserFaqQuestion[];
  followUp?: string[];
}

function normalizeQuestions(list: UserFaqQuestion[] | undefined): FaqQuestion[] {
  const out: FaqQuestion[] = [];
  for (const u of list || []) {
    // Een vraag zonder antwoord, of een antwoord zonder vraag, kan niets tonen.
    if (!u || !u.q || !u.a) continue;
    const url = (u.button && u.button.url) || '';
    out.push({
      q: u.q,
      a: u.a,
      ...(url ? { button: { label: (u.button && u.button.label) || u.q, url } } : {}),
    });
  }
  return out;
}

export function normalizeFaqs(
  user: Record<string, UserFaqDef> | undefined,
  defaultIntro: string,
): Record<string, FaqDef> {
  const out: Record<string, FaqDef> = {};
  for (const id of Object.keys(user || {})) {
    const u = (user || {})[id] || {};
    const questions = normalizeQuestions(u.questions);
    // Zonder bruikbare vraag valt er niets te openen; dan liever geen knop.
    if (!questions.length) continue;
    out[id] = {
      id,
      title: u.title || id,
      sub: u.sub || '',
      icon: u.icon || 'help',
      intro: u.intro || defaultIntro,
      questions,
      followUp: (u.followUp || []).slice(),
    };
  }
  return out;
}
