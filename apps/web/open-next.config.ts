import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Defaults work for most use cases.
  // If incremental cache (ISR) is needed later, configure here:
  //   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
  //   incrementalCache: r2IncrementalCache,
});
