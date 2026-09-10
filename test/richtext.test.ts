import { describe, expect, it } from 'vitest';
import { renderText } from '../src/ui/richtext';

describe('renderText', () => {
  it('wraps a single line in one paragraph', () => {
    expect(renderText('Hallo')).toBe('<p>Hallo</p>');
  });

  it('starts a new paragraph on a blank line and breaks on a single newline', () => {
    expect(renderText('Een\n\nTwee')).toBe('<p>Een</p><p>Twee</p>');
    expect(renderText('Een\nTwee')).toBe('<p>Een<br>Twee</p>');
  });

  it('turns **text** into strong', () => {
    expect(renderText('Wist je dat je **gratis** kunt proeven?')).toBe(
      '<p>Wist je dat je <strong>gratis</strong> kunt proeven?</p>',
    );
  });

  it('escapes everything else, including markup that looks like a tag', () => {
    expect(renderText('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(renderText('a & b')).toBe('<p>a &amp; b</p>');
    expect(renderText('<img src=x onerror="alert(1)">')).not.toContain('<img');
  });

  it('cannot be tricked into markup through the bold syntax', () => {
    expect(renderText('**<b>vet</b>**')).toBe('<p><strong>&lt;b&gt;vet&lt;/b&gt;</strong></p>');
  });

  it('leaves an unmatched or spaced asterisk pair alone', () => {
    expect(renderText('2 ** 3')).toBe('<p>2 ** 3</p>');
    expect(renderText('**open')).toBe('<p>**open</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(renderText('')).toBe('');
    expect(renderText('   ')).toBe('');
  });
});
