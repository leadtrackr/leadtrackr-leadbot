import { esc } from './views';

/**
 * Berichten en FAQ-antwoorden komen uit de config van de klantsite. Die tekst
 * wordt eerst volledig geëscapet en pas daarna krijgt een handjevol tekens
 * betekenis: `**vet**` en een lege regel als alinea. Zo kan er nooit HTML uit
 * een config de pagina in — ook niet als die config door iemand anders is gezet
 * dan wij.
 */
export function renderText(source: string): string {
  const text = (source || '').trim();
  if (!text) return '';
  return text
    .split(/\n\s*\n/)
    .map((para) => {
      // Het patroon eist een niet-witruimteteken direct binnen de sterretjes,
      // zodat "2 ** 3" gewoon blijft staan.
      const body = esc(para.trim())
        .replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return `<p>${body}</p>`;
    })
    .join('');
}
