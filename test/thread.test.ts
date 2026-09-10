import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { threadView, type ThreadState } from '../src/ui/thread';

const state = (over: Partial<ThreadState> = {}): ThreadState => ({
  channel: 'faq',
  messages: [],
  chips: [],
  typing: false,
  fresh: 0,
  ...over,
});

describe('threadView', () => {
  const cfg = resolveConfig('p1', { agentName: 'Ronald', companyName: 'Test' });

  it('renders a bot message with formatting and a user message as plain text', () => {
    const html = threadView(
      cfg,
      state({
        messages: [
          { from: 'bot', text: '**Hallo** daar' },
          { from: 'user', text: 'Wat zijn **jullie** openingstijden?' },
        ],
      }),
      { back: true },
    );
    expect(html).toContain('<strong>Hallo</strong>');
    expect(html).toContain('ltb-user');
    // wat de bezoeker typt is geen opmaak
    expect(html).toContain('**jullie**');
    expect(html).not.toContain('<strong>jullie</strong>');
  });

  it('renders a button inside a bot message', () => {
    const html = threadView(
      cfg,
      state({ messages: [{ from: 'bot', text: 'Kijk hier', button: { label: 'Winkelpagina', url: '/winkels' } }] }),
      { back: true },
    );
    expect(html).toContain('ltb-cardbtn');
    expect(html).toContain('href="/winkels"');
    expect(html).toContain('Winkelpagina');
  });

  it('renders chips with their styles and an action per chip', () => {
    const html = threadView(
      cfg,
      state({
        chips: [
          { id: 'whatsapp', label: 'WhatsApp', style: 'featured' },
          { id: 'restart', label: 'Iets anders bekijken', style: 'quiet' },
        ],
      }),
      { back: true },
    );
    expect(html).toContain('data-action="chip-whatsapp"');
    expect(html).toContain('ltb-opt--featured');
    expect(html).toContain('ltb-opt--quiet');
  });

  it('shows the typing indicator instead of chips while typing', () => {
    const html = threadView(cfg, state({ typing: true, chips: [{ id: 'a', label: 'A' }] }), { back: true });
    expect(html).toContain('ltb-typing');
    expect(html).not.toContain('data-action="chip-a"');
  });

  it('escapes anything a config puts in a chip label or a button', () => {
    const html = threadView(
      cfg,
      state({
        chips: [{ id: 'x', label: '<img src=x onerror=1>' }],
        messages: [{ from: 'bot', text: 'Hoi', button: { label: '<b>Ga</b>', url: '"><script>' } }],
      }),
      { back: true },
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Ga</b>');
    expect(html).not.toContain('"><script>');
  });

  it('shows a back button only when asked', () => {
    expect(threadView(cfg, state(), { back: true })).toContain('data-action="back"');
    expect(threadView(cfg, state(), { back: false })).not.toContain('data-action="back"');
  });

  it('always offers a way to close', () => {
    expect(threadView(cfg, state(), { back: false })).toContain('data-action="close"');
  });
});
