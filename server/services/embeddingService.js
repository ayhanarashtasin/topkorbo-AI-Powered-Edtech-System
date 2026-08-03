let extractorPromise = null;

function flattenEmbedding(output) {
  if (!output) return [];
  if (Array.isArray(output)) {
    return output.flat(Infinity).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  }
  if (output.data) {
    return Array.from(output.data).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  }
  if (typeof output.tolist === 'function') {
    return flattenEmbedding(output.tolist());
  }
  return [];
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers').then(({ pipeline }) => {
      const model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
      return pipeline('feature-extraction', model);
    });
  }
  return extractorPromise;
}

async function embedText(text) {
  const extractor = await getExtractor();
  const result = await extractor(String(text || ''), {
    pooling: 'mean',
    normalize: true
  });
  const embedding = flattenEmbedding(result);
  if (!embedding.length) {
    throw new Error('Failed to generate embedding');
  }
  return embedding;
}

module.exports = {
  embedText
};
