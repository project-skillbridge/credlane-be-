export const AI_RESOURCE_CONSTANTS = {
  // The number of items the AI is instructed to generate per category to create a pool
  POOL_GENERATION_COUNT: 15,

  // The number of resource items to randomly select and return
  RANDOM_RESOURCE_RETURN_COUNT: 5,

  // The number of video items to randomly select and return
  RANDOM_VIDEO_RETURN_COUNT: 6,

  /** @deprecated Use RANDOM_RESOURCE_RETURN_COUNT or RANDOM_VIDEO_RETURN_COUNT */
  RANDOM_RETURN_COUNT: 5,

  // Timeout for user-facing inline generation fallback (ms)
  INLINE_TIMEOUT_MS: 120_000,

  // Timeout for background cache warming generation (ms)
  BACKGROUND_TIMEOUT_MS: 300_000,
};
