export function cleanHtml(html?: string | null): string {
  if (!html) return 'No description available.';

  let text = html;

  // Convert common block tags to line breaks or bullets
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li>/gi, '• ');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse 3+ newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim whitespace
  text = text.trim();

  if (!text) return 'No description available.';

  return text;
}
