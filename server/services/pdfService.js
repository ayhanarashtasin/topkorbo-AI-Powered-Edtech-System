const { PDFParse } = require('pdf-parse');

function cleanText(text) {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdfPages(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('A PDF buffer is required');
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo({ parsePageInfo: true });
    const totalPages = Number(info?.total || info?.pages?.length || 0);
    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      throw new Error('Unable to determine PDF page count');
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      try {
        const result = await parser.getText({ partial: [pageNumber] });
        const text = cleanText(result?.text || '');
        pages.push({
          pageNumber,
          text,
          status: text ? 'completed' : 'empty',
          extractionMethod: 'pdf-parse',
          errorMessage: ''
        });
      } catch (err) {
        pages.push({
          pageNumber,
          text: '',
          status: 'failed',
          extractionMethod: 'pdf-parse',
          errorMessage: err?.message || 'Failed to extract page text'
        });
      }
    }

    return pages;
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}

function chunkTextByPages(pages, { chunkSizeWords = 650, overlapWords = 100 } = {}) {
  const chunks = [];
  let chunkIndex = 0;
  const words = [];

  const flushChunk = (chunkWords) => {
    const cleanWords = chunkWords.filter(Boolean);
    if (!cleanWords.length) return;
    const text = cleanWords.map((item) => item.word).join(' ').replace(/\s+\n/g, '\n').trim();
    if (!text) return;
    chunkIndex += 1;
    const pageNumbers = Array.from(new Set(cleanWords
      .map((item) => Number(item.pageNumber))
      .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0)))
      .sort((a, b) => a - b);
    chunks.push({
      chunkIndex,
      pageStart: pageNumbers[0] || 1,
      pageEnd: pageNumbers[pageNumbers.length - 1] || pageNumbers[0] || 1,
      pageNumbers,
      text
    });
  };

  for (const page of pages) {
    const pageText = String(page.text || '').trim();
    if (!pageText) continue;
    const pageWords = pageText.split(/\s+/).filter(Boolean).map((word) => ({ word, pageNumber: page.pageNumber }));
    words.push(...pageWords);
  }

  if (!words.length) return [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    flushChunk(words.slice(start, end));
    if (end >= words.length) break;
    const nextStart = Math.max(end - overlapWords, start + 1);
    start = nextStart;
  }

  return chunks;
}

module.exports = {
  extractPdfPages,
  chunkTextByPages
};
